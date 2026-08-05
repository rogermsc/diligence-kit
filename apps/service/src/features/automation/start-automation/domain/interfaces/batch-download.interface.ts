export interface ChunkDownloadTask {
    readonly chunkNumber: number
    readonly chunkPath: string
    readonly uploadId: string
}

export interface BatchDownloadResult {
    readonly successfulDownloads: Map<number, Buffer>
    readonly failedDownloads: number[]
    readonly totalProcessed: number
    readonly downloadDurationMs: number
}

export interface BatchDownloadPort {
    downloadChunksBatch(tasks: ChunkDownloadTask[]): Promise<BatchDownloadResult>
    calculateOptimalDownloadBatchSize(totalChunks: number): number
}

export interface ChunkAssemblyResult {
    readonly assembledBuffer: Buffer
    readonly totalChunks: number
    readonly assemblyDurationMs: number
    readonly downloadDurationMs: number
}
