import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EventBusPort, JobOptions } from '@/shared/domain/interfaces/event-bus.interface';
import { EventEmissionFailedError, EventBusError } from '@/shared/errors/event-error';
import { QueueFullError, RedisConnectionError } from '@/shared/errors/queue-error';

@Injectable()
export class BullMQEventBusAdapter implements EventBusPort {
    private readonly logger = new Logger(BullMQEventBusAdapter.name);
    private readonly handlers = new Map<string, any[]>();

    constructor(
        @InjectQueue('automation-queue') private readonly queue: Queue
    ) { }

    async emit(eventName: string, data: any): Promise<void> {
        this.logger.debug('Emitting event', {
            eventName,
        });

        try {
            await this.queue.add(eventName, data, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000
                },
                removeOnComplete: 100,
                removeOnFail: 50
            });

            this.logger.debug('Event queued successfully', { eventName });
        } catch (error) {
            this.logger.error('Failed to queue event', {
                eventName,
                error: error.message
            });

            if (error.message.includes('queue is full')) {
                throw new QueueFullError('automation-queue');
            } else if (error.message.includes('Redis')) {
                throw new RedisConnectionError('localhost', 6379);
            } else {
                throw new EventEmissionFailedError(eventName, error.message);
            }
        }
    }

    on(eventName: string, handler: any): void {
        const isValidEvent = this.handlers.has(eventName);

        if (!isValidEvent) {
            this.handlers.set(eventName, []);
        }
        this.handlers.get(eventName)!.push(handler);
    }

    // Remove o handler do evento
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