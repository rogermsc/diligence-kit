import { ChunkBatch, ChunkItem } from '../entities/chunk-batch.entity'

export interface BatchUploadResult {
    readonly successfulChunks: number[]
    readonly failedChunks: number[]
    readonly totalProcessed: number
    readonly uploadDurationMs: number
}

export interface BatchUploadPort {
    uploadChunkBatch(batch: ChunkBatch): Promise<BatchUploadResult>
    calculateOptimalBatchSize(totalChunks: number, averageChunkSize: number): number
}

export interface ChunkBatchAccumulator {
    addChunkToBatch(chunkItem: ChunkItem): Promise<boolean>
    getCurrentBatch(): ChunkBatch | null
    hasPendingBatch(): boolean
    flushCurrentBatch(): Promise<BatchUploadResult | null>
    getUploadId(): string
}
