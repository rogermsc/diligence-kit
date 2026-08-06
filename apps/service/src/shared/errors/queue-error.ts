import { ApplicationError } from "./errors"
import { ErrorType } from "./types"

export type QueueErrorType =
    | "JOB_FAILED"
    | "QUEUE_FULL"
    | "JOB_TIMEOUT"
    | "REDIS_CONNECTION_ERROR"
    | "JOB_NOT_FOUND"
    | "INVALID_JOB_DATA"
    | "WORKER_ERROR"
    | "RETRY_LIMIT_EXCEEDED"

export class JobFailedError extends ApplicationError<ErrorType> {
    constructor(jobId: string, error?: string) {
        super({
            message: `Job ${jobId} failed to process${error ? `: ${error}` : ""}`,
            code: 500,
            type: ErrorType.INTERNAL_SERVER_ERROR,
        })
    }
}

export class QueueFullError extends ApplicationError<ErrorType> {
    constructor(queueName: string) {
        super({
            message: `Queue ${queueName} is full and cannot accept new jobs`,
            code: 503,
            type: ErrorType.SERVICE_UNAVAILABLE,
        })
    }
}

export class JobTimeoutError extends ApplicationError<ErrorType> {
    constructor(jobId: string, timeoutMs: number) {
        super({
            message: `Job ${jobId} timed out after ${timeoutMs}ms`,
            code: 408,
            type: ErrorType.TIMEOUT_ERROR,
        })
    }
}

export class RedisConnectionError extends ApplicationError<ErrorType> {
    constructor(host: string, port: number) {
        super({
            message: `Failed to connect to Redis at ${host}:${port}`,
            code: 503,
            type: ErrorType.SERVICE_UNAVAILABLE,
        })
    }
}

export class JobNotFoundError extends ApplicationError<ErrorType> {
    constructor(jobId: string) {
        super({
            message: `Job ${jobId} not found in queue`,
            code: 404,
            type: ErrorType.NOT_FOUND,
        })
    }
}

export class InvalidJobDataError extends ApplicationError<ErrorType> {
    constructor(jobType: string, details?: string) {
        super({
            message: `Invalid data for job type ${jobType}${details ? `: ${details}` : ""}`,
            code: 400,
            type: ErrorType.VALIDATION_ERROR,
        })
    }
}

export class WorkerError extends ApplicationError<ErrorType> {
    constructor(workerName: string, error?: string) {
        super({
            message: `Worker ${workerName} encountered an error${error ? `: ${error}` : ""}`,
            code: 500,
            type: ErrorType.INTERNAL_SERVER_ERROR,
        })
    }
}

export class RetryLimitExceededError extends ApplicationError<ErrorType> {
    constructor(jobId: string, maxRetries: number) {
        super({
            message: `Job ${jobId} exceeded maximum retry limit of ${maxRetries}`,
            code: 500,
            type: ErrorType.INTERNAL_SERVER_ERROR,
        })
    }
}
