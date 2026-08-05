import { Injectable, Logger, Inject } from '@nestjs/common'
import { StorageService } from '@/shared/services/storage.service'
import { File } from '@/shared/domain/entities/file.entity'
import { ChunkBatch } from '../domain/entities/chunk-batch.entity'
import { BatchUploadPort, BatchUploadResult } from '../domain/interfaces/batch-upload.interface'
import { StorageError, StorageErrorType } from '@/shared/errors/storage-error'

interface ChunkUploadTask {
    readonly chunkNumber: number
    readonly chunkFile: File
    readonly storagePath: string
}

@Injectable()
export class BatchUploadAdapterService implements BatchUploadPort {
    private readonly logger = new Logger(BatchUploadAdapterService.name)
    private readonly TEMP_FOLDER_PREFIX = 'temp'
    private readonly CHUNK_FILE_EXTENSION = '.chunk'

    // Batch size optimization constants
    private readonly SMALL_BATCH_SIZE = 8
    private readonly MEDIUM_BATCH_SIZE = 5
    private readonly LARGE_BATCH_SIZE = 3
    private readonly CHUNK_SIZE_THRESHOLD_SMALL = 5 * 1024 * 1024 // 5MB
    private readonly CHUNK_SIZE_THRESHOLD_LARGE = 50 * 1024 * 1024 // 50MB

    constructor(
        @Inject('StorageService')
        private readonly storageService: StorageService
    ) { }

    async uploadChunkBatch(batch: ChunkBatch): Promise<BatchUploadResult> {
        const startTime = Date.now()
        const chunks = batch.getChunks()
        const uploadTasks = this.createUploadTasks(chunks, batch.getMetadata().uploadId)

        this.logger.debug('Starting batch upload', {
            uploadId: batch.getMetadata().uploadId,
            batchSize: batch.getBatchSize(),
            chunkNumbers: batch.getChunkNumbers()
        })

        const uploadPromises = uploadTasks.map(task => this.uploadSingleChunk(task))
        const uploadResults = await Promise.allSettled(uploadPromises)

        const successfulChunks: number[] = []
        const failedChunks: number[] = []

        uploadResults.forEach((result, index) => {
            const chunkNumber = uploadTasks[index].chunkNumber
            const uploadWasSuccessful = result.status === 'fulfilled'

            if (uploadWasSuccessful) {
                successfulChunks.push(chunkNumber)
            } else {
                failedChunks.push(chunkNumber)
                this.logger.error(`Chunk ${chunkNumber} upload failed`, {
                    reason: result.reason?.message || 'Unknown error'
                })
            }
        })

        const uploadDurationMs = Date.now() - startTime
        const totalProcessed = successfulChunks.length + failedChunks.length

        const allChunksUploadedSuccessfully = failedChunks.length === 0

        if (!allChunksUploadedSuccessfully) {
            this.logger.warn('Batch upload completed with failures', {
                uploadId: batch.getMetadata().uploadId,
                successfulChunks: successfulChunks.length,
                failedChunks: failedChunks.length,
                durationMs: uploadDurationMs
            })
        }

        return {
            successfulChunks,
            failedChunks,
            totalProcessed,
            uploadDurationMs
        }
    }

    calculateOptimalBatchSize(totalChunks: number, averageChunkSize: number): number {
        const chunkSizeIsSmall = averageChunkSize <= this.CHUNK_SIZE_THRESHOLD_SMALL
        const chunkSizeIsLarge = averageChunkSize >= this.CHUNK_SIZE_THRESHOLD_LARGE
        const totalChunksIsSmall = totalChunks <= 10

        if (chunkSizeIsSmall && totalChunksIsSmall) {
            return Math.min(this.SMALL_BATCH_SIZE, totalChunks)
        }

        if (chunkSizeIsLarge) {
            return Math.min(this.LARGE_BATCH_SIZE, totalChunks)
        }

        return Math.min(this.MEDIUM_BATCH_SIZE, totalChunks)
    }

    private createUploadTasks(chunks: any[], uploadId: string): ChunkUploadTask[] {
        return chunks.map(chunkItem => {
            const chunkFile = this.createChunkFile(chunkItem.file, chunkItem.chunkNumber)
            const storagePath = `${this.TEMP_FOLDER_PREFIX}/${uploadId}`

            return {
                chunkNumber: chunkItem.chunkNumber,
                chunkFile,
                storagePath
            }
        })
    }

    private async uploadSingleChunk(task: ChunkUploadTask): Promise<void> {
        try {
            await this.storageService.uploadSingleFile(task.storagePath, task.chunkFile)

            this.logger.debug(`Chunk ${task.chunkNumber} uploaded successfully`, {
                path: `${task.storagePath}/${task.chunkFile.name}`,
                size: task.chunkFile.size
            })

        } catch (error) {
            throw new StorageError(
                StorageErrorType.UPLOAD_ERROR,
                `Failed to upload chunk ${task.chunkNumber}: ${error.message}`
            )
        }
    }

    private createChunkFile(multerFile: any, chunkNumber: number): File {
        const chunkFileName = `${chunkNumber}${this.CHUNK_FILE_EXTENSION}`

        return new File(
            chunkFileName,
            multerFile.size,
            multerFile.mimetype,
            multerFile.buffer
        )
    }
}
