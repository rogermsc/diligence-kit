import { Injectable, Logger, Inject } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import {
    ChunkQueuedForRetryEvent,
    ChunkRetryAttemptEvent
} from '../domain/events/automation.events';
import { ChunkQueuedForRetryEventSchema, ChunkRetryAttemptEventSchema } from '../domain/events/automation.event-schemas';
import { EventBusPort } from '@/shared/domain/interfaces/event-bus.interface';

@Injectable()
@Processor('chunk-retry-queue')
export class ChunkRetryJobProcessor {
    private readonly logger = new Logger(ChunkRetryJobProcessor.name);
    private readonly MAX_RETRY_ATTEMPTS = 10;

    constructor(
        @Inject('EventBusPort')
        private readonly eventBus: EventBusPort
    ) { }

    @Process('chunk.queued.for.retry')
    async handleChunkQueuedForRetry(job: Job<ChunkQueuedForRetryEvent>): Promise<void> {
        const { uploadId, chunkNumber, totalChunks, file, metadata, companyId, automationId, retryAttempt, nextRetryAt } = ChunkQueuedForRetryEventSchema.parse(job.data);

        this.logger.debug('Processing chunk queued for retry', {
            uploadId,
            chunkNumber,
            retryAttempt,
            nextRetryAt
        });

        try {
            // Calcula delay para este retry
            const delayMs = this.calculateRetryDelay(retryAttempt);
            const scheduledTime = new Date(Date.now() + delayMs);

            // Agenda retry attempt
            await this.eventBus.emit('chunk.retry.attempt', {
                uploadId,
                chunkNumber,
                file,
                metadata,
                companyId,
                automationId,
                retryAttempt,
                maxRetries: this.MAX_RETRY_ATTEMPTS,
                delayMs,
                timestamp: new Date()
            });

            this.logger.debug(`Chunk ${chunkNumber} retry scheduled`, {
                uploadId,
                attempt: retryAttempt,
                delayMs,
                scheduledFor: scheduledTime.toISOString()
            });

        } catch (error) {
            this.logger.error(`Failed to process chunk queued for retry:`, error);
            throw error;
        }
    }

    @Process('chunk.retry.attempt')
    async handleChunkRetryAttempt(job: Job<ChunkRetryAttemptEvent>): Promise<void> {
        const { uploadId, chunkNumber, totalChunks, file, metadata, companyId, automationId, retryAttempt, maxRetries, delayMs } = ChunkRetryAttemptEventSchema.parse(job.data);

        this.logger.debug('Processing chunk retry attempt', {
            uploadId,
            chunkNumber,
            retryAttempt,
            maxRetries
        });

        // Aguarda o delay calculado
        await this.sleep(delayMs);

        try {
            // Re-emite o chunk para processamento na fila principal
            // Isso fará com que o ChunkProcessingJobProcessor verifique novamente
            // se as condições de ordem foram satisfeitas
            await this.eventBus.emit('chunk.registered', {
                uploadId,
                chunkNumber,
                totalChunks,
                file,
                metadata,
                companyId,
                automationId: automationId || '',
                timestamp: new Date(),
                registeredAt: new Date()
            });

            this.logger.debug(`Chunk ${chunkNumber} re-submitted for processing (attempt ${retryAttempt})`);

        } catch (error) {
            this.logger.error(`Retry attempt ${retryAttempt} failed for chunk ${chunkNumber}:`, error);

            if (retryAttempt < maxRetries) {
                // Agenda próximo retry
                await this.eventBus.emit('chunk.queued.for.retry', {
                    uploadId,
                    chunkNumber,
                    totalChunks,
                    file,
                    metadata,
                    companyId,
                    automationId,
                    retryAttempt: retryAttempt + 1,
                    nextRetryAt: new Date(Date.now() + this.calculateRetryDelay(retryAttempt + 1)),
                    reason: `Retry attempt ${retryAttempt} failed: ${error.message}`,
                    missingChunks: [],
                    timestamp: new Date()
                });
            } else {
                // Máximo de tentativas atingido
                this.logger.error(`Chunk ${chunkNumber} failed permanently after ${maxRetries} attempts`);
                // TODO: Emitir evento de falha permanente e fazer cleanup
            }
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private calculateRetryDelay(attempt: number, baseDelayMs: number = 1000): number {
        return Math.min(baseDelayMs * Math.pow(2, attempt - 1), 60000); // Max 60s
    }
}