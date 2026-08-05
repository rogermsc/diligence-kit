import { ApplicationError } from "@/shared/errors/errors"
import { ErrorType } from "@/shared/errors/types"

export type AutomationErrorType =
    | "CHUNK_PROCESSING_ERROR"
    | "ZIP_ASSEMBLY_ERROR"
    | "DOCUMENT_UPLOAD_ERROR"
    | "DOCUMENT_SAVE_ERROR"
    | "AGENT_NOTIFICATION_ERROR"
    | "AUTOMATION_CREATION_ERROR"
    | "CHUNK_VALIDATION_ERROR"
    | "AUTOMATION_JOB_FAILED"
    | "AUTOMATION_QUEUE_FULL"
    | "AUTOMATION_JOB_TIMEOUT"

export class ChunkProcessingError extends ApplicationError<ErrorType> {
    constructor(chunkNumber: number, totalChunks: number, error?: string) {
        super({
            message: `Failed to process chunk ${chunkNumber}/${totalChunks}${error ? `: ${error}` : ""}`,
            code: 500,
            type: ErrorType.INTERNAL_SERVER_ERROR,
        })
    }
}

export class ZipAssemblyError extends ApplicationError<ErrorType> {
    constructor(identifier: string, error?: string) {
        super({
            message: `Failed to assemble ZIP file with identifier ${identifier}${error ? `: ${error}` : ""}`,
            code: 500,
            type: ErrorType.INTERNAL_SERVER_ERROR,
        })
    }
}

export class DocumentUploadError extends ApplicationError<ErrorType> {
    constructor() {
        super({
            message: `Failed to upload documents for automation`,
            code: 500,
            type: ErrorType.INTERNAL_SERVER_ERROR,
        })
    }
}

export class DocumentSaveError extends ApplicationError<ErrorType> {
    constructor() {
        super({
            message: `Failed to save documents for automation`,
            code: 500,
            type: ErrorType.INTERNAL_SERVER_ERROR,
        })
    }
}

export class AgentNotificationError extends ApplicationError<ErrorType> {
    constructor() {
        super({
            message: `Failed to notify agent for automation`,
            code: 500,
            type: ErrorType.INTERNAL_SERVER_ERROR,
        })
    }
}

export class AutomationCreationError extends ApplicationError<ErrorType> {
    constructor() {
        super({
            message: `Failed to create automation for company`,
            code: 500,
            type: ErrorType.INTERNAL_SERVER_ERROR,
        })
    }
}

export class ChunkValidationError extends ApplicationError<ErrorType> {
    constructor(chunkData: any, error?: string) {
        super({
            message: `Invalid chunk data${error ? `: ${error}` : ""}`,
            code: 400,
            type: ErrorType.VALIDATION_ERROR,
        })
    }
}

export class AutomationJobFailedError extends ApplicationError<ErrorType> {
    constructor(jobType: string, automationId: string, error?: string) {
        super({
            message: `Automation job ${jobType} failed for automation ${automationId}${error ? `: ${error}` : ""}`,
            code: 500,
            type: ErrorType.INTERNAL_SERVER_ERROR,
        })
    }
}

export class AutomationQueueFullError extends ApplicationError<ErrorType> {
    constructor() {
        super({
            message: "Automation queue is full and cannot accept new jobs",
            code: 503,
            type: ErrorType.SERVICE_UNAVAILABLE,
        })
    }
}

export class AutomationJobTimeoutError extends ApplicationError<ErrorType> {
    constructor(jobType: string, automationId: string, timeoutMs: number) {
        super({
            message: `Automation job ${jobType} for automation ${automationId} timed out after ${timeoutMs}ms`,
            code: 408,
            type: ErrorType.TIMEOUT_ERROR,
        })
    }
}
