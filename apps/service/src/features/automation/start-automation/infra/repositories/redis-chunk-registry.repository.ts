import { ForbiddenException, Injectable, Logger } from "@nestjs/common"
import { Redis } from "ioredis"

export interface ChunkMetadata {
    uploadId: string
    chunkNumber: number
    totalChunks: number
    filename: string
    totalSize: number
    companyId: string
    automationId?: string // Opcional - será preenchido quando automação for criada
}

export interface UploadState {
    uploadId: string
    totalChunks: number
    confirmedChunks: Set<number>
    pendingChunks: Set<number>
    metadata: ChunkMetadata
    createdAt: Date
    lastActivity: Date
}

export interface ChunkRegistry {
    registerChunk(
        uploadId: string,
        chunkNumber: number,
        metadata: ChunkMetadata,
    ): Promise<void>
    incrementProcessedCount(uploadId: string): Promise<number> // Novo método para incrementar contador
    getProcessedCount(uploadId: string): Promise<number> // Novo método para obter contador
    getTotalChunks(uploadId: string): Promise<number> // Novo método para obter total
    isUploadComplete(uploadId: string): Promise<boolean>
    getUploadState(uploadId: string): Promise<UploadState | null>
    updateAutomationId(
        uploadId: string,
        automationId: string,
        companyId: string,
    ): Promise<void>
    cleanupUpload(uploadId: string): Promise<void>
    // Manter métodos antigos para compatibilidade com AssemblyCoordinator
    getAllConfirmedChunks(uploadId: string): Promise<number[]>
}

@Injectable()
export class RedisChunkRegistry implements ChunkRegistry {
    private readonly logger = new Logger(RedisChunkRegistry.name)
    private readonly redis: Redis
    private readonly UPLOAD_PREFIX = "upload:"
    private readonly CONFIRMED_PREFIX = "confirmed:"
    private readonly METADATA_PREFIX = "metadata:"
    private readonly PROCESSED_COUNT_PREFIX = "processed_count:" // Novo prefixo para contador
    private readonly UPLOAD_TIMEOUT = 1000 * 60 * 60 // 1 hora

    constructor() {
        this.redis = new Redis({
            host: process.env.REDIS_HOST!,
            port: parseInt(process.env.REDIS_PORT!),
            lazyConnect: true,
        })
    }

    /**
     * Refuses unless `companyId` is the company that claimed this upload id.
     *
     * Absent or unreadable metadata is a refusal, not a pass: the previous
     * version only compared when a company was present, so a record written
     * without one, or an id whose metadata had expired, went through unchecked.
     */
    private async assertOwns(
        uploadId: string,
        companyId: string,
    ): Promise<void> {
        const raw = await this.redis.get(`${this.METADATA_PREFIX}${uploadId}`)
        let owner: string | undefined

        if (raw) {
            try {
                owner = (JSON.parse(raw) as ChunkMetadata).companyId
            } catch {
                owner = undefined
            }
        }

        if (!owner || !companyId || owner !== companyId) {
            this.logger.warn(
                `Refusing access to upload ${uploadId}: claimed by ` +
                    `${owner ?? "nobody"}, requested by ${companyId || "nobody"}.`,
            )
            throw new ForbiddenException(
                "Upload identifier belongs to another upload",
            )
        }
    }

    async registerChunk(
        uploadId: string,
        chunkNumber: number,
        metadata: ChunkMetadata,
    ): Promise<void> {
        const uploadKey = `${this.UPLOAD_PREFIX}${uploadId}`
        const metadataKey = `${this.METADATA_PREFIX}${uploadId}`

        try {
            // The upload id is chosen by the client and these keys carry no
            // tenant component, so a caller who guesses an in-flight id could
            // otherwise add chunks to someone else's upload and rebind it to
            // their own automation. The first chunk claims the id for a company;
            // every later chunk has to agree.
            //
            // NX rather than GET-then-SETEX: two concurrent first chunks both
            // saw an empty key under the read-then-write version, both wrote,
            // and the later writer silently took ownership.
            const claimed = await this.redis.set(
                metadataKey,
                JSON.stringify({
                    ...metadata,
                    createdAt: new Date().toISOString(),
                    lastActivity: new Date().toISOString(),
                }),
                "EX",
                this.UPLOAD_TIMEOUT / 1000,
                "NX",
            )

            if (!claimed) {
                await this.assertOwns(uploadId, metadata.companyId)
            }

            // Adiciona chunk à lista de chunks registrados
            await this.redis.sadd(`${uploadKey}:registered`, chunkNumber)

            // Atualiza atividade
            await this.redis.expire(uploadKey, this.UPLOAD_TIMEOUT / 1000)

            this.logger.debug(
                `Chunk ${chunkNumber} registered for upload ${uploadId}`,
            )
        } catch (error) {
            if (error instanceof ForbiddenException) throw error
            this.logger.error(
                `Failed to register chunk ${chunkNumber} for upload ${uploadId}:`,
                error,
            )
            throw error
        }
    }

    async incrementProcessedCount(uploadId: string): Promise<number> {
        const countKey = `${this.PROCESSED_COUNT_PREFIX}${uploadId}`

        try {
            // Incrementa contador atômico
            const newCount = await this.redis.incr(countKey)

            // Define TTL na primeira vez
            if (newCount === 1) {
                await this.redis.expire(countKey, this.UPLOAD_TIMEOUT / 1000)
            }

            // Atualiza atividade nos metadados
            const metadataKey = `${this.METADATA_PREFIX}${uploadId}`
            const metadataStr = await this.redis.get(metadataKey)
            if (metadataStr) {
                const metadata = JSON.parse(metadataStr)
                metadata.lastActivity = new Date().toISOString()
                await this.redis.setex(
                    metadataKey,
                    this.UPLOAD_TIMEOUT / 1000,
                    JSON.stringify(metadata),
                )
            }

            this.logger.debug(
                `Processed count for upload ${uploadId}: ${newCount}`,
            )
            return newCount
        } catch (error) {
            this.logger.error(
                `Failed to increment processed count for upload ${uploadId}:`,
                error,
            )
            throw error
        }
    }

    async getProcessedCount(uploadId: string): Promise<number> {
        const countKey = `${this.PROCESSED_COUNT_PREFIX}${uploadId}`

        try {
            const count = await this.redis.get(countKey)
            return count ? parseInt(count) : 0
        } catch (error) {
            this.logger.error(
                `Failed to get processed count for upload ${uploadId}:`,
                error,
            )
            return 0
        }
    }

    async getTotalChunks(uploadId: string): Promise<number> {
        try {
            const metadataKey = `${this.METADATA_PREFIX}${uploadId}`
            const metadataStr = await this.redis.get(metadataKey)

            if (!metadataStr) {
                return 0
            }

            const metadata = JSON.parse(metadataStr)
            return metadata.totalChunks || 0
        } catch (error) {
            this.logger.error(
                `Failed to get total chunks for upload ${uploadId}:`,
                error,
            )
            return 0
        }
    }

    async isChunkConfirmed(
        uploadId: string,
        chunkNumber: number,
    ): Promise<boolean> {
        const confirmedKey = `${this.CONFIRMED_PREFIX}${uploadId}`

        try {
            const result = await this.redis.sismember(confirmedKey, chunkNumber)
            return result === 1
        } catch (error) {
            this.logger.error(
                `Failed to check if chunk ${chunkNumber} is confirmed for upload ${uploadId}:`,
                error,
            )
            return false
        }
    }

    async areAllPreviousChunksConfirmed(
        uploadId: string,
        chunkNumber: number,
    ): Promise<boolean> {
        // Chunk 1 não tem predecessores
        if (chunkNumber <= 1) {
            return true
        }

        try {
            const confirmedKey = `${this.CONFIRMED_PREFIX}${uploadId}`
            const confirmedChunks = await this.redis.smembers(confirmedKey)
            const confirmedNumbers = confirmedChunks
                .map((c) => parseInt(c))
                .sort((a, b) => a - b)

            // Verifica se todos os chunks de 1 até chunkNumber-1 estão confirmados
            for (let i = 1; i < chunkNumber; i++) {
                if (!confirmedNumbers.includes(i)) {
                    this.logger.debug(
                        `Chunk ${i} not confirmed yet for upload ${uploadId}, cannot process chunk ${chunkNumber}`,
                    )
                    return false
                }
            }

            return true
        } catch (error) {
            this.logger.error(
                `Failed to check previous chunks for upload ${uploadId}, chunk ${chunkNumber}:`,
                error,
            )
            return false
        }
    }

    async getAllConfirmedChunks(uploadId: string): Promise<number[]> {
        const confirmedKey = `${this.CONFIRMED_PREFIX}${uploadId}`

        try {
            const confirmedChunks = await this.redis.smembers(confirmedKey)
            return confirmedChunks.map((c) => parseInt(c)).sort((a, b) => a - b)
        } catch (error) {
            this.logger.error(
                `Failed to get confirmed chunks for upload ${uploadId}:`,
                error,
            )
            return []
        }
    }

    async isUploadComplete(uploadId: string): Promise<boolean> {
        try {
            const totalChunks = await this.getTotalChunks(uploadId)
            const processedCount = await this.getProcessedCount(uploadId)

            const isComplete = processedCount === totalChunks && totalChunks > 0

            if (isComplete) {
                this.logger.log(
                    `Upload ${uploadId} is complete - all ${totalChunks} chunks processed`,
                )
            }

            return isComplete
        } catch (error) {
            this.logger.error(
                `Failed to check if upload ${uploadId} is complete:`,
                error,
            )
            return false
        }
    }

    async getUploadState(uploadId: string): Promise<UploadState | null> {
        try {
            const metadataKey = `${this.METADATA_PREFIX}${uploadId}`
            const metadataStr = await this.redis.get(metadataKey)

            if (!metadataStr) {
                return null
            }

            const metadata = JSON.parse(metadataStr)
            const confirmedChunks = await this.getAllConfirmedChunks(uploadId)
            const confirmedSet = new Set(confirmedChunks)

            // Calcula chunks pendentes
            const allChunks = Array.from(
                { length: metadata.totalChunks },
                (_, i) => i + 1,
            )
            const pendingChunks = allChunks.filter(
                (chunk) => !confirmedSet.has(chunk),
            )

            return {
                uploadId,
                totalChunks: metadata.totalChunks,
                confirmedChunks: confirmedSet,
                pendingChunks: new Set(pendingChunks),
                metadata: {
                    uploadId: metadata.uploadId,
                    chunkNumber: 0, // N/A for state
                    totalChunks: metadata.totalChunks,
                    filename: metadata.filename,
                    totalSize: metadata.totalSize,
                    companyId: metadata.companyId,
                    automationId: metadata.automationId, // Adicionar automationId
                },
                createdAt: new Date(metadata.createdAt),
                lastActivity: new Date(metadata.lastActivity),
            }
        } catch (error) {
            this.logger.error(
                `Failed to get upload state for ${uploadId}:`,
                error,
            )
            return null
        }
    }

    async updateAutomationId(
        uploadId: string,
        automationId: string,
        companyId: string,
    ): Promise<void> {
        // This is the call that actually performs the rebind, and it was
        // reachable directly from the controller with a caller-chosen upload id.
        // Guarding registerChunk alone left the hole open: the attacker never
        // has to register a chunk, only to claim the last one.
        await this.assertOwns(uploadId, companyId)

        try {
            const metadataKey = `${this.METADATA_PREFIX}${uploadId}`
            const metadataStr = await this.redis.get(metadataKey)

            if (metadataStr) {
                const metadata = JSON.parse(metadataStr)
                metadata.automationId = automationId
                metadata.lastActivity = new Date().toISOString()

                await this.redis.setex(
                    metadataKey,
                    this.UPLOAD_TIMEOUT / 1000,
                    JSON.stringify(metadata),
                )

                this.logger.debug(
                    `Updated automationId for upload ${uploadId}: ${automationId}`,
                )
            }
        } catch (error) {
            this.logger.error(
                `Failed to update automationId for upload ${uploadId}:`,
                error,
            )
        }
    }

    async cleanupUpload(uploadId: string): Promise<void> {
        try {
            const uploadKey = `${this.UPLOAD_PREFIX}${uploadId}`
            const confirmedKey = `${this.CONFIRMED_PREFIX}${uploadId}`
            const metadataKey = `${this.METADATA_PREFIX}${uploadId}`
            const processedCountKey = `${this.PROCESSED_COUNT_PREFIX}${uploadId}`

            await Promise.all([
                this.redis.del(`${uploadKey}:registered`),
                this.redis.del(confirmedKey),
                this.redis.del(metadataKey),
                this.redis.del(processedCountKey), // Limpar contador também
            ])

            this.logger.debug(`Cleaned up upload ${uploadId} from registry`)
        } catch (error) {
            this.logger.error(`Failed to cleanup upload ${uploadId}:`, error)
        }
    }
}
