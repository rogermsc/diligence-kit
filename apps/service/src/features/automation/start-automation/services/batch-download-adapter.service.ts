import { Injectable, Logger, Inject } from "@nestjs/common"
import { StorageService } from "@/shared/services/storage.service"
import {
    ChunkDownloadTask,
    BatchDownloadResult,
    BatchDownloadPort,
} from "../domain/interfaces/batch-download.interface"
import { StorageError, StorageErrorType } from "@/shared/errors/storage-error"

@Injectable()
export class BatchDownloadAdapterService implements BatchDownloadPort {
    private readonly logger = new Logger(BatchDownloadAdapterService.name)

    // Batch size optimization constants
    private readonly SMALL_DOWNLOAD_BATCH_SIZE = 10
    private readonly MEDIUM_DOWNLOAD_BATCH_SIZE = 6
    private readonly LARGE_DOWNLOAD_BATCH_SIZE = 4
    private readonly CHUNK_COUNT_THRESHOLD_SMALL = 20
    private readonly CHUNK_COUNT_THRESHOLD_LARGE = 100

    constructor(
        @Inject("StorageService")
        private readonly storageService: StorageService,
    ) {}

    async downloadChunksBatch(
        tasks: ChunkDownloadTask[],
    ): Promise<BatchDownloadResult> {
        const startTime = Date.now()
        const chunkNumbers = tasks.map((task) => task.chunkNumber)

        this.logger.debug("Starting batch download", {
            batchSize: tasks.length,
            chunkNumbers,
        })

        const downloadPromises = tasks.map((task) =>
            this.downloadSingleChunkSafely(task),
        )
        const downloadResults = await Promise.allSettled(downloadPromises)

        const successfulDownloads = new Map<number, Buffer>()
        const failedDownloads: number[] = []

        downloadResults.forEach((result, index) => {
            const task = tasks[index]
            const downloadWasSuccessful = result.status === "fulfilled"

            if (downloadWasSuccessful) {
                successfulDownloads.set(task.chunkNumber, result.value)
            } else {
                failedDownloads.push(task.chunkNumber)
                this.logger.error(`Chunk ${task.chunkNumber} download failed`, {
                    chunkPath: task.chunkPath,
                    reason: result.reason?.message || "Unknown error",
                })
            }
        })

        const downloadDurationMs = Date.now() - startTime
        const totalProcessed = successfulDownloads.size + failedDownloads.length

        const allDownloadsSuccessful = failedDownloads.length === 0

        if (!allDownloadsSuccessful) {
            this.logger.warn("Batch download completed with failures", {
                successfulDownloads: successfulDownloads.size,
                failedDownloads: failedDownloads.length,
                durationMs: downloadDurationMs,
            })
        }

        return {
            successfulDownloads,
            failedDownloads,
            totalProcessed,
            downloadDurationMs,
        }
    }

    calculateOptimalDownloadBatchSize(totalChunks: number): number {
        const chunkCountIsSmall =
            totalChunks <= this.CHUNK_COUNT_THRESHOLD_SMALL
        const chunkCountIsLarge =
            totalChunks >= this.CHUNK_COUNT_THRESHOLD_LARGE

        if (chunkCountIsSmall) {
            return Math.min(this.SMALL_DOWNLOAD_BATCH_SIZE, totalChunks)
        }

        if (chunkCountIsLarge) {
            return Math.min(this.LARGE_DOWNLOAD_BATCH_SIZE, totalChunks)
        }

        return Math.min(this.MEDIUM_DOWNLOAD_BATCH_SIZE, totalChunks)
    }

    private async downloadSingleChunkSafely(
        task: ChunkDownloadTask,
    ): Promise<Buffer> {
        try {
            const chunkBuffer = await this.storageService.downloadFile(
                task.chunkPath,
            )

            const chunkIsEmpty = !chunkBuffer || chunkBuffer.length === 0

            if (chunkIsEmpty) {
                throw new StorageError(
                    StorageErrorType.UPLOAD_ERROR,
                    `Chunk ${task.chunkNumber} is empty or corrupted`,
                )
            }

            this.logger.debug(
                `Chunk ${task.chunkNumber} downloaded successfully`,
                {
                    size: chunkBuffer.length,
                    uploadId: task.uploadId,
                },
            )

            return chunkBuffer
        } catch (error) {
            throw new StorageError(
                StorageErrorType.UPLOAD_ERROR,
                `Failed to download chunk ${task.chunkNumber}: ${error.message}`,
            )
        }
    }
}
