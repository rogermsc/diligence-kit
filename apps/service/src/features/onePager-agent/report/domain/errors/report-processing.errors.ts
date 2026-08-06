import { ApplicationError } from "@/shared/errors/errors"

export type ReportProcessingErrorType =
    | "REPORT_PAYLOAD_VALIDATION_ERROR"
    | "REPORT_AUTOMATION_NOT_FOUND"
    | "REPORT_AGENT_STAGE_MISMATCH"
    | "REPORT_CREATION_FAILED"
    | "REPORT_PROCESSING_ERROR"

export class ReportPayloadValidationError extends ApplicationError<ReportProcessingErrorType> {
    constructor() {
        super({
            message: `Invalid report payload`,
            code: 400,
            type: "REPORT_PAYLOAD_VALIDATION_ERROR",
        })
    }
}

export class ReportAutomationNotFoundError extends ApplicationError<ReportProcessingErrorType> {
    constructor() {
        super({
            message: `Automation not found for report processing`,
            code: 404,
            type: "REPORT_AUTOMATION_NOT_FOUND",
        })
    }
}

export class ReportAgentStageMismatchError extends ApplicationError<ReportProcessingErrorType> {
    constructor(
        automationId: string,
        agentDomain: string,
        automationStage: string,
        expectedStage: string,
    ) {
        super({
            message: `Agent type '${agentDomain}' does not match automation stage '${automationStage}' for automation ${automationId}. Expected stage: '${expectedStage}'`,
            code: 409,
            type: "REPORT_AGENT_STAGE_MISMATCH",
        })
    }
}

export class ReportCreationFailedError extends ApplicationError<ReportProcessingErrorType> {
    constructor(automationId: string, domain: string, reason?: string) {
        super({
            message: `Failed to create report for automation ${automationId} and domain ${domain}${reason ? `: ${reason}` : ""}`,
            code: 500,
            type: "REPORT_CREATION_FAILED",
        })
    }
}

export class ReportProcessingError extends ApplicationError<ReportProcessingErrorType> {
    constructor(automationId: string, error?: string) {
        super({
            message: `Failed to process report for automation ${automationId}${error ? `: ${error}` : ""}`,
            code: 500,
            type: "REPORT_PROCESSING_ERROR",
        })
    }
}
