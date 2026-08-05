import { ApplicationError } from "@/shared/errors/errors"

export enum AutomationErrorType {
    AUTOMATION_NOT_FOUND = "AUTOMATION_NOT_FOUND",
    AUTOMATION_CREATION_FAILED = "AUTOMATION_CREATION_FAILED",
    AUTOMATION_AGENT_ERROR = "AUTOMATION_AGENT_ERROR",
    AUTOMATION_COMPANY_NOT_FOUND = "AUTOMATION_COMPANY_NOT_FOUND",
    AUTOMATION_UPLOAD_FAILED = "AUTOMATION_UPLOAD_FAILED",
    AUTOMATION_ALREADY_IN_PROGRESS = "AUTOMATION_ALREADY_IN_PROGRESS",
    AUTOMATION_ZIP_VALIDATION_ERROR = "AUTOMATION_ZIP_VALIDATION_ERROR",
    ONE_PAGER_NOT_FOUND = "ONE_PAGER_NOT_FOUND",
    ONE_PAGER_VALIDATION_ERROR = "ONE_PAGER_VALIDATION_ERROR",
    AUTOMATION_NOT_COMPLETED = "AUTOMATION_NOT_COMPLETED",
    AUTOMATION_CANNOT_START_TRIAGE = "AUTOMATION_CANNOT_START_TRIAGE",
}

export class AutomationNotFoundError extends ApplicationError<AutomationErrorType> {
    constructor() {
        super({
            message: "Automation not found",
            code: 404,
            type: AutomationErrorType.AUTOMATION_NOT_FOUND,
        })
    }
}

export class AutomationCreationFailedError extends ApplicationError<AutomationErrorType> {
    constructor() {
        super({
            message: "Failed to create automation",
            code: 500,
            type: AutomationErrorType.AUTOMATION_CREATION_FAILED,
        })
    }
}

export class AutomationAgentError extends ApplicationError<AutomationErrorType> {
    constructor() {
        super({
            message: "Agent error while processing automation",
            code: 500,
            type: AutomationErrorType.AUTOMATION_AGENT_ERROR,
        })
    }
}

export class AutomationCompanyNotFoundError extends ApplicationError<AutomationErrorType> {
    constructor(companyId: string) {
        super({
            message: `Company with ID ${companyId} not found for automation`,
            code: 404,
            type: AutomationErrorType.AUTOMATION_COMPANY_NOT_FOUND,
        })
    }
}

export class AutomationUploadFailedError extends ApplicationError<AutomationErrorType> {
    constructor() {
        super({
            message: "Failed to upload automation documents",
            code: 500,
            type: AutomationErrorType.AUTOMATION_UPLOAD_FAILED,
        })
    }
}

export class AutomationAlreadyInProgressError extends ApplicationError<AutomationErrorType> {
    constructor() {
        super({
            message:
                "There is already an automation in progress for this company",
            code: 403,
            type: AutomationErrorType.AUTOMATION_ALREADY_IN_PROGRESS,
        })
    }
}

export class AutomationZipValidationError extends ApplicationError<AutomationErrorType> {
    constructor(message: string) {
        super({
            message: `Erro de validação do arquivo ZIP: ${message}`,
            code: 400,
            type: AutomationErrorType.AUTOMATION_ZIP_VALIDATION_ERROR,
        })
    }
}

export class OnePagerNotFoundError extends ApplicationError<AutomationErrorType> {
    constructor(automationId: string) {
        super({
            message: `One-pager not found for automation ${automationId}`,
            code: 404,
            type: AutomationErrorType.ONE_PAGER_NOT_FOUND,
        })
    }
}

export class OnePagerValidationError extends ApplicationError<AutomationErrorType> {
    constructor(message: string) {
        super({
            message: `One-pager validation error: ${message}`,
            code: 400,
            type: AutomationErrorType.ONE_PAGER_VALIDATION_ERROR,
        })
    }
}

export class AutomationCannotStartTriageError extends ApplicationError<AutomationErrorType> {
    constructor() {
        super({
            message: `Automation cannot start TRIAGE with current state`,
            code: 400,
            type: AutomationErrorType.AUTOMATION_CANNOT_START_TRIAGE,
        })
    }
}

export class AutomationNotCompletedError extends ApplicationError<AutomationErrorType> {
    constructor(automationId: string) {
        super({
            message: `Automation ${automationId} is not completed. One-pager is only available for completed automations`,
            code: 400,
            type: AutomationErrorType.AUTOMATION_NOT_COMPLETED,
        })
    }
}
