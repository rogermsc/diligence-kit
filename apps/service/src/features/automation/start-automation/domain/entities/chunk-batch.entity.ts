import { File as MulterFile } from "multer"

export interface ChunkBatchMetadata {
    readonly uploadId: string
    readonly totalChunks: number
    readonly originalFilename: string
    readonly totalSize: number
    readonly companyId: string
}

export interface ChunkItem {
    readonly chunkNumber: number
    readonly file: MulterFile
    readonly metadata: ChunkBatchMetadata
}

export class ChunkBatch {
    private readonly chunks: Map<number, ChunkItem> = new Map()
    private readonly maxBatchSize: number
    private readonly batchMetadata: ChunkBatchMetadata

    constructor(metadata: ChunkBatchMetadata, maxBatchSize: number = 5) {
        this.batchMetadata = metadata
        this.maxBatchSize = maxBatchSize
    }

    addChunk(chunkItem: ChunkItem): void {
        const chunkAlreadyExists = this.chunks.has(chunkItem.chunkNumber)

        if (chunkAlreadyExists) {
            throw new Error(
                `Chunk ${chunkItem.chunkNumber} already exists in batch`,
            )
        }

        this.chunks.set(chunkItem.chunkNumber, chunkItem)
    }

    getChunks(): ChunkItem[] {
        return Array.from(this.chunks.values()).sort(
            (chunkA, chunkB) => chunkA.chunkNumber - chunkB.chunkNumber,
        )
    }

    getChunkNumbers(): number[] {
        return this.getChunks().map((chunk) => chunk.chunkNumber)
    }

    getBatchSize(): number {
        return this.chunks.size
    }

    isBatchFull(): boolean {
        const currentBatchSize = this.getBatchSize()
        return currentBatchSize >= this.maxBatchSize
    }

    isBatchEmpty(): boolean {
        const currentBatchSize = this.getBatchSize()
        return currentBatchSize === 0
    }

    canAcceptMoreChunks(): boolean {
        return !this.isBatchFull()
    }

    getMetadata(): ChunkBatchMetadata {
        return this.batchMetadata
    }

    clear(): void {
        this.chunks.clear()
    }
}
