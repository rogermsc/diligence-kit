import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EventBusPort } from '@/shared/domain/interfaces/event-bus.interface';
import { EventEmissionFailedError } from '@/shared/errors/event-error';
import { QueueFullError, RedisConnectionError } from '@/shared/errors/queue-error';

@Injectable()
export class MultiQueueEventBusAdapter implements EventBusPort {
    private readonly logger = new Logger(MultiQueueEventBusAdapter.name);
    private readonly handlers = new Map<string, any[]>();

    // Mapeamento de eventos para filas
    private readonly eventToQueueMap = new Map<string, string>([
        // Chunk processing events
        ['chunk.registered', 'chunk-processing-queue'],
        ['chunk.confirmed', 'chunk-processing-queue'],

        // Retry events
        ['chunk.queued.for.retry', 'chunk-retry-queue'],
        ['chunk.retry.attempt', 'chunk-retry-queue'],

        // Assembly events
        ['upload.ready.for.assembly', 'assembly-queue'],

        // Existing automation events (mantém na fila original)
        ['chunk.received', 'automation-queue'],
        ['automation.created', 'automation-queue'],
        ['automation.updated', 'automation-queue'],
        ['zip.complete', 'automation-queue'],
        ['zip.assembled', 'automation-queue'],
        ['documents.uploaded', 'automation-queue'],
        ['agent.notification.ready', 'automation-queue'],
    ]);

    constructor(
        @InjectQueue('automation-queue') private readonly automationQueue: Queue,
        @InjectQueue('chunk-processing-queue') private readonly chunkProcessingQueue: Queue,
        @InjectQueue('chunk-retry-queue') private readonly chunkRetryQueue: Queue,
        @InjectQueue('assembly-queue') private readonly assemblyQueue: Queue,
    ) { }

    async emit(eventName: string, data: any): Promise<void> {
        this.logger.debug('Emitting event', { eventName });

        try {
            const queueName = this.eventToQueueMap.get(eventName) || 'automation-queue';
            const queue = this.getQueueByName(queueName);

            await queue.add(eventName, data, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000
                },
                // remove imediatamente jobs concluídos para não acumular na fila
                removeOnComplete: true,
                removeOnFail: 50
            });

            this.logger.debug('Event queued successfully', {
                eventName,
                queueName
            });

        } catch (error) {
            this.logger.error('Failed to queue event', {
                eventName,
                error: error.message
            });

            if (error.message.includes('queue is full')) {
                throw new QueueFullError('multi-queue');
            } else if (error.message.includes('Redis')) {
                throw new RedisConnectionError('localhost', 6379);
            } else {
                throw new EventEmissionFailedError(eventName, error.message);
            }
        }
    }

    private getQueueByName(queueName: string): Queue {
        switch (queueName) {
            case 'chunk-processing-queue':
                return this.chunkProcessingQueue;
            case 'chunk-retry-queue':
                return this.chunkRetryQueue;
            case 'assembly-queue':
                return this.assemblyQueue;
            case 'automation-queue':
            default:
                return this.automationQueue;
        }
    }

    on(eventName: string, handler: any): void {
        const isValidEvent = this.handlers.has(eventName);

        if (!isValidEvent) {
            this.handlers.set(eventName, []);
        }
        this.handlers.get(eventName)!.push(handler);
    }

    off(eventName: string, handler: any): void {
        const handlers = this.handlers.get(eventName);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
}