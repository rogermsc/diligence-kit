import { Injectable, Logger, Inject } from "@nestjs/common"
import { File as MulterFile } from "multer"
import {
    BatchChunkProcessorService,
    BatchChunkProcessResult,
} from "./batch-chunk-processor.service"
import {
    ChunkRegistry,
    ChunkMetadata,
} from "../infra/repositories/redis-chunk-registry.repository"

export interface EnhancedChunkProcessResult {
    readonly success: boolean
    readonly processedCount: number
    readonly totalChunks: number
    readonly batchProcessed: boolean
    readonly allChunksReceived: boolean
    readonly error?: string
}

@Injectable()
export class EnhancedChunkProcessorService {
    private readonly logger = new Logger(EnhancedChunkProcessorService.name)

    constructor(
        private readonly batchProcessor: BatchChunkProcessorService,
        @Inject("ChunkRegistry")
        private readonly chunkRegistry: ChunkRegistry,
    ) {}

    async processChunk(
        uploadedChunk: MulterFile,
        chunkNumber: number,
        totalChunks: number,
        uploadId: string,
        metadata: ChunkMetadata,
    ): Promise<EnhancedChunkProcessResult> {
        try {
            const batchResult = await this.batchProcessor.processChunkInBatch(
                uploadedChunk,
                chunkNumber,
                totalChunks,
                uploadId,
                metadata,
            )

            const allChunksReceived = this.checkIfAllChunksReceived(
                batchResult.processedCount,
                totalChunks,
            )

            // If all chunks received, flush any pending batch
            if (allChunksReceived) {
                await this.batchProcessor.flushPendingBatches(uploadId)

                this.logger.log("All chunks processed for upload", {
                    uploadId,
                    totalChunks,
                    processedCount: batchResult.processedCount,
                })
            }

            return {
                success: batchResult.success,
                processedCount: batchResult.processedCount,
                totalChunks: batchResult.totalChunks,
                batchProcessed: batchResult.batchProcessed,
                allChunksReceived,
                error: batchResult.error,
            }
        } catch (error) {
            this.logger.error(
                `Enhanced chunk processing failed for chunk ${chunkNumber}`,
                {
                    uploadId,
                    error: error.message,
                },
            )

            const processedCount =
                await this.chunkRegistry.getProcessedCount(uploadId)
            const allChunksReceived = this.checkIfAllChunksReceived(
                processedCount,
                totalChunks,
            )

            return {
                success: false,
                processedCount,
                totalChunks,
                batchProcessed: false,
                allChunksReceived,
                error: error.message,
            }
        }
    }

    private checkIfAllChunksReceived(
        processedCount: number,
        totalChunks: number,
    ): boolean {
        return processedCount >= totalChunks
    }
}
