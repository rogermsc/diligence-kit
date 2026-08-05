import { Injectable, Logger } from '@nestjs/common'
import { ChunkBatch, ChunkItem, ChunkBatchMetadata } from '../domain/entities/chunk-batch.entity'
import { ChunkBatchAccumulator, BatchUploadResult, BatchUploadPort } from '../domain/interfaces/batch-upload.interface'

@Injectable()
export class ChunkBatchAccumulatorService implements ChunkBatchAccumulator {
    private readonly logger = new Logger(ChunkBatchAccumulatorService.name)
    private currentBatch: ChunkBatch | null = null
    private readonly uploadId: string
    private readonly batchUploadPort: BatchUploadPort

    constructor(
        uploadId: string,
        batchUploadPort: BatchUploadPort,
        private readonly optimalBatchSize: number = 5
    ) {
        this.uploadId = uploadId
        this.batchUploadPort = batchUploadPort
    }

    async addChunkToBatch(chunkItem: ChunkItem): Promise<boolean> {
        const chunkBelongsToThisUpload = chunkItem.metadata.uploadId === this.uploadId

        if (!chunkBelongsToThisUpload) {
            throw new Error(`Chunk belongs to different upload. Expected: ${this.uploadId}, Got: ${chunkItem.metadata.uploadId}`)
        }

        const needsNewBatch = this.shouldCreateNewBatch()

        if (needsNewBatch) {
            await this.flushCurrentBatchIfExists()
            this.createNewBatch(chunkItem.metadata)
        }

        this.currentBatch!.addChunk(chunkItem)

        const batchIsFull = this.currentBatch!.isBatchFull()

        if (batchIsFull) {
            await this.flushCurrentBatch()
            return true
        }

        return false
    }

    getCurrentBatch(): ChunkBatch | null {
        return this.currentBatch
    }

    hasPendingBatch(): boolean {
        const batchExists = this.currentBatch !== null
        const batchHasChunks = batchExists && !this.currentBatch!.isBatchEmpty()

        return batchHasChunks
    }

    async flushCurrentBatch(): Promise<BatchUploadResult | null> {
        const noBatchToFlush = !this.hasPendingBatch()

        if (noBatchToFlush) {
            return null
        }

        const batchToUpload = this.currentBatch!
        const chunkNumbers = batchToUpload.getChunkNumbers()

        this.logger.debug('Flushing batch for upload', {
            uploadId: this.uploadId,
            batchSize: batchToUpload.getBatchSize(),
            chunkNumbers
        })

        try {
            const uploadResult = await this.batchUploadPort.uploadChunkBatch(batchToUpload)

            this.logger.log('Batch upload completed', {
                uploadId: this.uploadId,
                successfulChunks: uploadResult.successfulChunks.length,
                failedChunks: uploadResult.failedChunks.length,
                durationMs: uploadResult.uploadDurationMs
            })

            this.clearCurrentBatch()
            return uploadResult

        } catch (error) {
            this.logger.error('Batch upload failed', {
                uploadId: this.uploadId,
                chunkNumbers,
                error: error.message
            })

            this.clearCurrentBatch()
            throw error
        }
    }

    getUploadId(): string {
        return this.uploadId
    }

    private shouldCreateNewBatch(): boolean {
        const noBatchExists = this.currentBatch === null
        const batchIsFull = this.currentBatch?.isBatchFull() ?? false

        return noBatchExists || batchIsFull
    }

    private async flushCurrentBatchIfExists(): Promise<void> {
        const hasBatchToFlush = this.hasPendingBatch()

        if (hasBatchToFlush) {
            await this.flushCurrentBatch()
        }
    }

    private createNewBatch(metadata: ChunkBatchMetadata): void {
        this.currentBatch = new ChunkBatch(metadata, this.optimalBatchSize)
    }

    private clearCurrentBatch(): void {
        this.currentBatch = null
    }
}
