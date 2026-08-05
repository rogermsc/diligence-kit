import { ApplicationError } from "./errors"
import { ErrorType } from "./types"

export type EventErrorType =
    | "EVENT_EMISSION_FAILED"
    | "EVENT_HANDLER_NOT_FOUND"
    | "EVENT_HANDLER_FAILED"
    | "INVALID_EVENT_DATA"
    | "EVENT_TIMEOUT"
    | "EVENT_BUS_ERROR"
    | "EVENT_VALIDATION_FAILED"
    | "EVENT_PROCESSING_ERROR"

export class EventEmissionFailedError extends ApplicationError<ErrorType> {
    constructor(eventName: string, error?: string) {
        super({
            message: `Failed to emit event ${eventName}${error ? `: ${error}` : ""}`,
            code: 500,
            type: ErrorType.INTERNAL_SERVER_ERROR,
        })
    }
}

export class EventHandlerNotFoundError extends ApplicationError<ErrorType> {
    constructor(eventName: string) {
        super({
            message: `No handler found for event ${eventName}`,
            code: 404,
            type: ErrorType.NOT_FOUND,
        })
    }
}

export class EventHandlerFailedError extends ApplicationError<ErrorType> {
    constructor(eventName: string, handlerName: string, error?: string) {
        super({
            message: `Handler ${handlerName} failed for event ${eventName}${error ? `: ${error}` : ""}`,
            code: 500,
            type: ErrorType.INTERNAL_SERVER_ERROR,
        })
    }
}

export class InvalidEventDataError extends ApplicationError<ErrorType> {
    constructor(eventName: string, details?: string) {
        super({
            message: `Invalid data for event ${eventName}${details ? `: ${details}` : ""}`,
            code: 400,
            type: ErrorType.VALIDATION_ERROR,
        })
    }
}

export class EventTimeoutError extends ApplicationError<ErrorType> {
    constructor(eventName: string, timeoutMs: number) {
        super({
            message: `Event ${eventName} timed out after ${timeoutMs}ms`,
            code: 408,
            type: ErrorType.TIMEOUT_ERROR,
        })
    }
}

export class EventBusError extends ApplicationError<ErrorType> {
    constructor(busName: string, error?: string) {
        super({
            message: `Event bus ${busName} encountered an error${error ? `: ${error}` : ""}`,
            code: 503,
            type: ErrorType.SERVICE_UNAVAILABLE,
        })
    }
}

export class EventValidationFailedError extends ApplicationError<ErrorType> {
    constructor(eventName: string, validationErrors: string[]) {
        super({
            message: `Event ${eventName} validation failed: ${validationErrors.join(", ")}`,
            code: 400,
            type: ErrorType.VALIDATION_ERROR,
        })
    }
}

export class EventProcessingError extends ApplicationError<ErrorType> {
    constructor(eventName: string, step: string, error?: string) {
        super({
            message: `Error processing event ${eventName} at step ${step}${error ? `: ${error}` : ""}`,
            code: 500,
            type: ErrorType.INTERNAL_SERVER_ERROR,
        })
    }
} 