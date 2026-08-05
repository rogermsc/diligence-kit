import { Injectable, Logger, Inject } from '@nestjs/common'
import { File as MulterFile } from 'multer'
import { BatchDownloadAdapterService } from './batch-download-adapter.service'
import { ChunkDownloadTask, ChunkAssemblyResult } from '../domain/interfaces/batch-download.interface'
import { StorageError, StorageErrorType } from '@/shared/errors/storage-error'

export interface EnhancedAssemblyResult {
    readonly success: boolean
    readonly assembledFile?: MulterFile
    readonly error?: string
    readonly assemblyDurationMs: number
    readonly downloadDurationMs: number
    readonly totalChunks: number
}

@Injectable()
export class EnhancedAssemblyCoordinatorService {
    private readonly logger = new Logger(EnhancedAssemblyCoordinatorService.name)
    private readonly TEMP_FOLDER_PREFIX = 'temp'
    private readonly CHUNK_FILE_EXTENSION = '.chunk'

    constructor(
        private readonly batchDownloadAdapter: BatchDownloadAdapterService
    ) { }

    async startEnhancedAssembly(
        uploadId: string,
        totalChunks: number,
        originalFilename: string
    ): Promise<EnhancedAssemblyResult> {
        const assemblyStartTime = Date.now()

        this.logger.log('Starting enhanced assembly with batch download', {
            uploadId,
            totalChunks,
            originalFilename
        })

        try {
            const assemblyResult = await this.downloadAndAssembleChunksInBatches(
                uploadId,
                totalChunks
            )

            const assembledFile = this.createAssembledFile(originalFilename, assemblyResult.assembledBuffer)
            const totalAssemblyDurationMs = Date.now() - assemblyStartTime

            this.logger.log('Enhanced assembly completed successfully', {
                uploadId,
                totalChunks,
                finalFileSize: assemblyResult.assembledBuffer.length,
                downloadDurationMs: assemblyResult.downloadDurationMs,
                assemblyDurationMs: assemblyResult.assemblyDurationMs,
                totalDurationMs: totalAssemblyDurationMs
            })

            return {
                success: true,
                assembledFile,
                assemblyDurationMs: totalAssemblyDurationMs,
                downloadDurationMs: assemblyResult.downloadDurationMs,
                totalChunks
            }

        } catch (error) {
            const totalAssemblyDurationMs = Date.now() - assemblyStartTime

            this.logger.error('Enhanced assembly failed', {
                uploadId,
                totalChunks,
                error: error.message,
                durationMs: totalAssemblyDurationMs
            })

            return {
                success: false,
                error: error.message,
                assemblyDurationMs: totalAssemblyDurationMs,
                downloadDurationMs: 0,
                totalChunks
            }
        }
    }

    private async downloadAndAssembleChunksInBatches(
        uploadId: string,
        totalChunks: number
    ): Promise<ChunkAssemblyResult> {
        const downloadStartTime = Date.now()

        const downloadTasks = this.createDownloadTasks(uploadId, totalChunks)
        const optimalBatchSize = this.batchDownloadAdapter.calculateOptimalDownloadBatchSize(totalChunks)

        this.logger.debug('Processing chunks in batches', {
            uploadId,
            totalChunks,
            optimalBatchSize,
            totalBatches: Math.ceil(downloadTasks.length / optimalBatchSize)
        })

        const allChunkBuffers = new Map<number, Buffer>()

        // Process chunks in batches
        for (let batchStartIndex = 0; batchStartIndex < downloadTasks.length; batchStartIndex += optimalBatchSize) {
            const batchEndIndex = Math.min(batchStartIndex + optimalBatchSize, downloadTasks.length)
            const currentBatch = downloadTasks.slice(batchStartIndex, batchEndIndex)
            const batchNumber = Math.floor(batchStartIndex / optimalBatchSize) + 1
            const totalBatches = Math.ceil(downloadTasks.length / optimalBatchSize)

            this.logger.debug(`Processing batch ${batchNumber}/${totalBatches}`, {
                uploadId,
                batchSize: currentBatch.length,
                chunkNumbers: currentBatch.map(task => task.chunkNumber)
            })

            const batchResult = await this.batchDownloadAdapter.downloadChunksBatch(currentBatch)

            const batchHasFailures = batchResult.failedDownloads.length > 0

            if (batchHasFailures) {
                throw new StorageError(
                    StorageErrorType.UPLOAD_ERROR,
                    `Failed to download chunks in batch ${batchNumber}: ${batchResult.failedDownloads.join(', ')}`
                )
            }

            // Merge successful downloads
            batchResult.successfulDownloads.forEach((buffer, chunkNumber) => {
                allChunkBuffers.set(chunkNumber, buffer)
            })
        }

        const downloadDurationMs = Date.now() - downloadStartTime

        // Assemble chunks in correct order
        const assemblyResult = this.assembleChunksInOrder(allChunkBuffers, totalChunks)

        return {
            assembledBuffer: assemblyResult.assembledBuffer,
            totalChunks,
            assemblyDurationMs: assemblyResult.assemblyDurationMs,
            downloadDurationMs
        }
    }

    private createDownloadTasks(uploadId: string, totalChunks: number): ChunkDownloadTask[] {
        const downloadTasks: ChunkDownloadTask[] = []

        for (let chunkNumber = 1; chunkNumber <= totalChunks; chunkNumber++) {
            const chunkPath = this.buildChunkPath(uploadId, chunkNumber)

            downloadTasks.push({
                chunkNumber,
                chunkPath,
                uploadId
            })
        }

        return downloadTasks
    }

    private assembleChunksInOrder(
        chunkBuffers: Map<number, Buffer>,
        totalChunks: number
    ): { assembledBuffer: Buffer; assemblyDurationMs: number } {
        const assemblyStartTime = Date.now()
        const orderedBuffers: Buffer[] = []

        for (let chunkNumber = 1; chunkNumber <= totalChunks; chunkNumber++) {
            const chunkBuffer = chunkBuffers.get(chunkNumber)
            const chunkIsMissing = !chunkBuffer

            if (chunkIsMissing) {
                throw new StorageError(
                    StorageErrorType.UPLOAD_ERROR,
                    `Missing chunk ${chunkNumber} during assembly`
                )
            }

            orderedBuffers.push(chunkBuffer)
        }

        const assembledBuffer = Buffer.concat(orderedBuffers)
        const assemblyDurationMs = Date.now() - assemblyStartTime

        this.logger.debug('Chunks assembled in correct order', {
            totalChunks,
            finalSize: assembledBuffer.length,
            assemblyDurationMs
        })

        return {
            assembledBuffer,
            assemblyDurationMs
        }
    }

    private buildChunkPath(uploadId: string, chunkNumber: number): string {
        return `${this.TEMP_FOLDER_PREFIX}/${uploadId}/${chunkNumber}${this.CHUNK_FILE_EXTENSION}`
    }

    private createAssembledFile(filename: string, buffer: Buffer): MulterFile {
        return {
            originalname: filename,
            mimetype: 'application/zip',
            size: buffer.length,
            buffer,
            encoding: '7bit',
            fieldname: 'file'
        } as MulterFile
    }
}
