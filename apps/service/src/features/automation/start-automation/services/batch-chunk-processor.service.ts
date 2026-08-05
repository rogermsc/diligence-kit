import { Injectable, Logger, Inject } from '@nestjs/common'
import { File as MulterFile } from 'multer'
import { ChunkBatchAccumulatorService } from './chunk-batch-accumulator.service'
import { BatchUploadAdapterService } from './batch-upload-adapter.service'
import { ChunkItem, ChunkBatchMetadata } from '../domain/entities/chunk-batch.entity'
import { ChunkRegistry, ChunkMetadata } from '../infra/repositories/redis-chunk-registry.repository'
import { BatchUploadResult } from '../domain/interfaces/batch-upload.interface'

export interface BatchChunkProcessResult {
    readonly success: boolean
    readonly processedCount: number
    readonly totalChunks: number
    readonly batchProcessed: boolean
    readonly error?: string
}

@Injectable()
export class BatchChunkProcessorService {
    private readonly logger = new Logger(BatchChunkProcessorService.name)
    private readonly batchAccumulators = new Map<string, ChunkBatchAccumulatorService>()

    constructor(
        private readonly batchUploadAdapter: BatchUploadAdapterService,
        @Inject('ChunkRegistry')
        private readonly chunkRegistry: ChunkRegistry
    ) { }

    async processChunkInBatch(
        uploadedChunk: MulterFile,
        chunkNumber: number,
        totalChunks: number,
        uploadId: string,
        chunkMetadata: ChunkMetadata
    ): Promise<BatchChunkProcessResult> {
        try {
            const batchMetadata = this.createBatchMetadata(uploadId, totalChunks, chunkMetadata)
            const chunkItem = this.createChunkItem(uploadedChunk, chunkNumber, batchMetadata)

            const batchAccumulator = this.getOrCreateBatchAccumulator(uploadId, totalChunks)
            const batchWasFlushed = await batchAccumulator.addChunkToBatch(chunkItem)

            // Register chunk in registry for tracking
            await this.chunkRegistry.registerChunk(uploadId, chunkNumber, chunkMetadata)
            const processedCount = await this.chunkRegistry.incrementProcessedCount(uploadId)

            this.logger.debug('Chunk added to batch', {
                uploadId,
                chunkNumber,
                processedCount,
                totalChunks,
                batchWasFlushed
            })

            return {
                success: true,
                processedCount,
                totalChunks,
                batchProcessed: batchWasFlushed
            }

        } catch (error) {
            this.logger.error(`Failed to process chunk ${chunkNumber} in batch`, {
                uploadId,
                error: error.message
            })

            const processedCount = await this.chunkRegistry.getProcessedCount(uploadId)

            return {
                success: false,
                processedCount,
                totalChunks,
                batchProcessed: false,
                error: error.message
            }
        }
    }

    async flushPendingBatches(uploadId: string): Promise<BatchUploadResult | null> {
        const batchAccumulator = this.batchAccumulators.get(uploadId)
        const noBatchAccumulatorExists = !batchAccumulator

        if (noBatchAccumulatorExists) {
            return null
        }

        const hasPendingBatch = batchAccumulator.hasPendingBatch()

        if (!hasPendingBatch) {
            this.cleanupBatchAccumulator(uploadId)
            return null
        }

        try {
            const flushResult = await batchAccumulator.flushCurrentBatch()
            this.cleanupBatchAccumulator(uploadId)

            this.logger.log('Final batch flushed for upload', {
                uploadId,
                result: flushResult
            })

            return flushResult

        } catch (error) {
            this.logger.error('Failed to flush pending batch', {
                uploadId,
                error: error.message
            })

            this.cleanupBatchAccumulator(uploadId)
            throw error
        }
    }

    private getOrCreateBatchAccumulator(uploadId: string, totalChunks: number): ChunkBatchAccumulatorService {
        const existingAccumulator = this.batchAccumulators.get(uploadId)
        const accumulatorAlreadyExists = existingAccumulator !== undefined

        if (accumulatorAlreadyExists) {
            return existingAccumulator
        }

        const averageChunkSize = this.estimateAverageChunkSize()
        const optimalBatchSize = this.batchUploadAdapter.calculateOptimalBatchSize(totalChunks, averageChunkSize)

        const newAccumulator = new ChunkBatchAccumulatorService(
            uploadId,
            this.batchUploadAdapter,
            optimalBatchSize
        )

        this.batchAccumulators.set(uploadId, newAccumulator)

        this.logger.debug('Created new batch accumulator', {
            uploadId,
            optimalBatchSize,
            totalChunks
        })

        return newAccumulator
    }

    private createBatchMetadata(
        uploadId: string,
        totalChunks: number,
        chunkMetadata: ChunkMetadata
    ): ChunkBatchMetadata {
        return {
            uploadId,
            totalChunks,
            originalFilename: chunkMetadata.filename,
            totalSize: chunkMetadata.totalSize,
            companyId: chunkMetadata.companyId || '',
        }
    }

    private createChunkItem(
        uploadedChunk: MulterFile,
        chunkNumber: number,
        batchMetadata: ChunkBatchMetadata
    ): ChunkItem {
        return {
            chunkNumber,
            file: uploadedChunk,
            metadata: batchMetadata
        }
    }

    private cleanupBatchAccumulator(uploadId: string): void {
        this.batchAccumulators.delete(uploadId)

        this.logger.debug('Cleaned up batch accumulator', {
            uploadId,
            remainingAccumulators: this.batchAccumulators.size
        })
    }

    private estimateAverageChunkSize(): number {
        // Default estimate for chunk size - could be made more sophisticated
        // by tracking actual chunk sizes over time
        return 2 * 1024 * 1024 // 2MB default estimate
    }
}
