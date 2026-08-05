import { Injectable, Logger, Inject } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import {
    ChunkRegisteredEvent,
    ChunkQueuedForRetryEvent,
    ChunkConfirmedEvent,
    ChunkRetryAttemptEvent,
    UploadReadyForAssemblyEvent
} from '../domain/events/automation.events';
import { ChunkRegisteredEventSchema } from '../domain/events/automation.event-schemas';
import { EnhancedChunkProcessorService } from '../services/enhanced-chunk-processor.service';
import { ChunkRegistry } from '../infra/repositories/redis-chunk-registry.repository';
import { EventBusPort } from '@/shared/domain/interfaces/event-bus.interface';

@Injectable()
@Processor('chunk-processing-queue')
export class ChunkProcessingJobProcessor {
    private readonly logger = new Logger(ChunkProcessingJobProcessor.name);

    constructor(
        private readonly enhancedChunkProcessor: EnhancedChunkProcessorService,
        @Inject('ChunkRegistry')
        private readonly chunkRegistry: ChunkRegistry,
        @Inject('EventBusPort')
        private readonly eventBus: EventBusPort
    ) { }

    @Process({ name: 'chunk.registered', concurrency: 1 })
    async handleChunkRegistered(job: Job<ChunkRegisteredEvent>): Promise<void> {
        const { uploadId, chunkNumber, totalChunks, file: serializedFile, metadata, companyId, automationId } = ChunkRegisteredEventSchema.parse(job.data);

        try {
            const isPayloadValid = serializedFile && serializedFile.buffer;

            if (!isPayloadValid) {
                this.logger.warn('Missing file payload on chunk.registered; scheduling retry', { uploadId, chunkNumber });

                await this.eventBus.emit('chunk.queued.for.retry', {
                    uploadId,
                    chunkNumber,
                    totalChunks,
                    file: serializedFile,
                    metadata,
                    companyId,
                    automationId,
                    retryAttempt: 1,
                    nextRetryAt: new Date(Date.now() + this.calculateRetryDelay(1)),
                    reason: 'Missing file payload',
                    missingChunks: [],
                    timestamp: new Date()
                });
                return;
            }

            const file = {
                ...serializedFile,
                buffer: Buffer.from(serializedFile.buffer, 'base64')
            };

            const result = await this.enhancedChunkProcessor.processChunk(
                file,
                chunkNumber,
                totalChunks,
                uploadId,
                {
                    uploadId,
                    chunkNumber,
                    totalChunks,
                    filename: metadata.filename,
                    totalSize: metadata.totalSize,
                    companyId,
                }
            );

            const isChunkProcessedSuccessfully = result.success;

            if (isChunkProcessedSuccessfully) {
                this.logger.debug(`Chunk ${chunkNumber} processed successfully`, {
                    uploadId,
                    processedCount: result.processedCount,
                    totalChunks: result.totalChunks
                });

                const isComplete = result.allChunksReceived;

                if (isComplete) {
                    const uploadState = await this.chunkRegistry.getUploadState(uploadId);
                    const automationIdFromRegistry = uploadState?.metadata?.automationId || automationId;

                    this.logger.log(`All chunks processed for upload ${uploadId}, triggering assembly`, {
                        uploadId,
                        processedCount: result.processedCount,
                        totalChunks: result.totalChunks,
                        automationId: automationIdFromRegistry,
                        uploadStateExists: !!uploadState,
                        metadataExists: !!uploadState?.metadata,
                        automationIdInMetadata: uploadState?.metadata?.automationId,
                        fallbackAutomationId: automationId
                    });

                    // Validação do automationId
                    if (!automationIdFromRegistry || automationIdFromRegistry.trim() === '') {
                        this.logger.error(`Cannot trigger assembly: automationId is empty for upload ${uploadId}`, {
                            uploadId,
                            automationIdFromRegistry,
                            uploadState: uploadState ? 'exists' : 'null',
                            metadata: uploadState?.metadata
                        });
                        throw new Error(`AutomationId is required for assembly but was empty for upload ${uploadId}`);
                    }

                    await this.eventBus.emit('upload.ready.for.assembly', {
                        uploadId,
                        totalChunks,
                        confirmedChunks: [], // Assembly coordinator vai ordenar os chunks
                        originalFilename: metadata.filename,
                        totalSize: metadata.totalSize,
                        companyId,
                        companyName: '', // Será obtido no assembly processor
                        automationId: automationIdFromRegistry,
                        readyAt: new Date(),
                        timestamp: new Date()
                    });
                }
            } else {
                // Erro no processamento
                this.logger.error(`Chunk ${chunkNumber} failed:`, result.error);
                throw new Error(result.error);
            }

        } catch (error) {
            this.logger.error(`Failed to process registered chunk ${chunkNumber}:`, error);
            throw error;
        }
    }

    private calculateRetryDelay(attempt: number, baseDelayMs: number = 1000): number {
        return Math.min(baseDelayMs * Math.pow(2, attempt - 1), 60000); // Max 60s
    }
}