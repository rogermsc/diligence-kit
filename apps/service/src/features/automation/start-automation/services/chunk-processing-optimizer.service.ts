import { Injectable, Logger } from "@nestjs/common"
import { File as MulterFile } from "multer"

export interface OptimizedChunkData {
    readonly chunkNumber: number
    readonly processedFile: MulterFile
    readonly processingDurationMs: number
    readonly originalSize: number
    readonly processedSize: number
}

export interface BatchProcessingResult {
    readonly processedChunks: OptimizedChunkData[]
    readonly totalProcessingDurationMs: number
    readonly averageChunkSize: number
    readonly compressionRatio: number
}

@Injectable()
export class ChunkProcessingOptimizerService {
    private readonly logger = new Logger(ChunkProcessingOptimizerService.name)

    // Buffer pool for reusing Buffer instances
    private readonly bufferPool = new Map<number, Buffer[]>()
    private readonly MAX_POOLED_BUFFERS_PER_SIZE = 10

    /**
     * Optimized batch processing of base64 chunks with buffer pooling
     */
    async optimizeBatchChunkProcessing(
        serializedChunks: Array<{
            chunkNumber: number
            serializedFile: any
            uploadId: string
        }>,
    ): Promise<BatchProcessingResult> {
        const processingStartTime = Date.now()

        this.logger.debug("Starting optimized batch chunk processing", {
            batchSize: serializedChunks.length,
            chunkNumbers: serializedChunks.map((chunk) => chunk.chunkNumber),
        })

        const processedChunks = await Promise.all(
            serializedChunks.map((chunk) =>
                this.optimizeChunkDeserialization(chunk),
            ),
        )

        const totalProcessingDurationMs = Date.now() - processingStartTime
        const averageChunkSize = this.calculateAverageChunkSize(processedChunks)
        const compressionRatio = this.calculateCompressionRatio(processedChunks)

        this.logger.debug("Batch chunk processing completed", {
            processedChunks: processedChunks.length,
            totalDurationMs: totalProcessingDurationMs,
            averageChunkSize,
            compressionRatio,
        })

        return {
            processedChunks,
            totalProcessingDurationMs,
            averageChunkSize,
            compressionRatio,
        }
    }

    /**
     * Optimized single chunk deserialization with buffer pooling
     */
    private async optimizeChunkDeserialization(chunkData: {
        chunkNumber: number
        serializedFile: any
        uploadId: string
    }): Promise<OptimizedChunkData> {
        const processingStartTime = Date.now()
        const { chunkNumber, serializedFile } = chunkData

        try {
            const originalBase64Size = serializedFile.buffer.length

            // Use optimized base64 decoding with buffer pooling
            const decodedBuffer = this.optimizedBase64Decode(
                serializedFile.buffer,
                serializedFile.size,
            )

            const processedFile: MulterFile = {
                ...serializedFile,
                buffer: decodedBuffer,
            }

            const processingDurationMs = Date.now() - processingStartTime

            return {
                chunkNumber,
                processedFile,
                processingDurationMs,
                originalSize: originalBase64Size,
                processedSize: decodedBuffer.length,
            }
        } catch (error) {
            this.logger.error(`Failed to optimize chunk ${chunkNumber}`, {
                error: error.message,
                uploadId: chunkData.uploadId,
            })
            throw error
        }
    }

    /**
     * Optimized base64 decoding with buffer pooling
     */
    private optimizedBase64Decode(
        base64String: string,
        expectedSize: number,
    ): Buffer {
        const pooledBuffer = this.getPooledBuffer(expectedSize)

        if (pooledBuffer) {
            // Reuse existing buffer for better memory performance
            const decodedLength = Buffer.from(base64String, "base64").copy(
                pooledBuffer,
            )
            return pooledBuffer.subarray(0, decodedLength)
        }

        // Create new buffer and add to pool for future reuse
        const newBuffer = Buffer.from(base64String, "base64")
        this.addBufferToPool(expectedSize, Buffer.alloc(expectedSize))

        return newBuffer
    }

    /**
     * Get a buffer from the pool if available
     */
    private getPooledBuffer(size: number): Buffer | null {
        const buffersForSize = this.bufferPool.get(size)
        const hasAvailableBuffer = buffersForSize && buffersForSize.length > 0

        if (hasAvailableBuffer) {
            return buffersForSize.pop()!
        }

        return null
    }

    /**
     * Add buffer to pool for reuse
     */
    private addBufferToPool(size: number, buffer: Buffer): void {
        const buffersForSize = this.bufferPool.get(size) || []
        const poolHasSpace =
            buffersForSize.length < this.MAX_POOLED_BUFFERS_PER_SIZE

        if (poolHasSpace) {
            buffersForSize.push(buffer)
            this.bufferPool.set(size, buffersForSize)
        }
    }

    /**
     * Calculate average chunk size for optimization metrics
     */
    private calculateAverageChunkSize(
        processedChunks: OptimizedChunkData[],
    ): number {
        const totalSize = processedChunks.reduce(
            (sum, chunk) => sum + chunk.processedSize,
            0,
        )
        return Math.round(totalSize / processedChunks.length)
    }

    /**
     * Calculate compression ratio (base64 vs binary)
     */
    private calculateCompressionRatio(
        processedChunks: OptimizedChunkData[],
    ): number {
        const totalOriginalSize = processedChunks.reduce(
            (sum, chunk) => sum + chunk.originalSize,
            0,
        )
        const totalProcessedSize = processedChunks.reduce(
            (sum, chunk) => sum + chunk.processedSize,
            0,
        )

        const compressionRatio = totalOriginalSize / totalProcessedSize
        return Math.round(compressionRatio * 100) / 100
    }

    /**
     * Clear buffer pool to free memory
     */
    clearBufferPool(): void {
        this.bufferPool.clear()
        this.logger.debug("Buffer pool cleared")
    }
}
