import { AgentType } from "@/features/onePager-agent/agent/domain/agent-type"
import { ApplicationError } from "@/shared/errors/errors"

export enum ReportErrorType {
    REPORT_NOT_FOUND = "REPORT_NOT_FOUND",
    REPORT_CREATION_FAILED = "REPORT_CREATION_FAILED",
    REPORT_UPDATE_FAILED = "REPORT_UPDATE_FAILED",
    INVALID_AUTOMATION_DOMAIN = "INVALID_AUTOMATION_DOMAIN",
    INCOMPLETE_AGENT_REPORTS = "INCOMPLETE_AGENT_REPORTS",
    EXPIRED_REPORTS_CLEANUP_FAILED = "EXPIRED_REPORTS_CLEANUP_FAILED",
    UNSUPPORTED_REPORT_STATUS = "UNSUPPORTED_REPORT_STATUS",
}

export class ReportNotFoundError extends ApplicationError<ReportErrorType> {
    constructor(automationId: string, domain?: AgentType) {
        const message = domain
            ? `Report not found for automation ${automationId} and domain ${domain}`
            : `No reports found for automation ${automationId}`

        super({
            message,
            code: 404,
            type: ReportErrorType.REPORT_NOT_FOUND,
        })
    }
}

export class ReportCompletedUrlNotFoundError extends ApplicationError<ReportErrorType> {
    constructor() {
        super({
            message: "Report URL not found, but necessary in COMPLETED status",
            code: 404,
            type: ReportErrorType.REPORT_NOT_FOUND,
        })
    }
}

export class ReportCreationFailedError extends ApplicationError<ReportErrorType> {
    constructor() {
        super({
            message: "Report creation failed",
            code: 500,
            type: ReportErrorType.REPORT_CREATION_FAILED,
        })
    }
}

export class ReportUpdateFailedError extends ApplicationError<ReportErrorType> {
    constructor(automationId: string, domain: AgentType, reason?: string) {
        const message = reason
            ? `Failed to update report for automation ${automationId} and domain ${domain}: ${reason}`
            : `Failed to update report for automation ${automationId} and domain ${domain}`

        super({
            message,
            code: 500,
            type: ReportErrorType.REPORT_UPDATE_FAILED,
        })
    }
}

export class InvalidAutomationDomainError extends ApplicationError<ReportErrorType> {
    constructor(automationId: string, domain: AgentType) {
        super({
            message: `Invalid combination of automation ${automationId} and domain ${domain}`,
            code: 400,
            type: ReportErrorType.INVALID_AUTOMATION_DOMAIN,
        })
    }
}

export class IncompleteAgentReportsError extends ApplicationError<ReportErrorType> {
    constructor(
        automationId: string,
        currentCount: number,
        requiredCount: number = 4,
    ) {
        super({
            message: `Incomplete agent reports for automation ${automationId}. Found ${currentCount} of ${requiredCount} required reports`,
            code: 422,
            type: ReportErrorType.INCOMPLETE_AGENT_REPORTS,
        })
    }
}

export class ExpiredReportsCleanupFailedError extends ApplicationError<ReportErrorType> {
    constructor(reason?: string) {
        const message = reason
            ? `Failed to cleanup expired reports: ${reason}`
            : `Failed to cleanup expired reports`

        super({
            message,
            code: 500,
            type: ReportErrorType.EXPIRED_REPORTS_CLEANUP_FAILED,
        })
    }
}

export class UnsupportedReportStatusError extends ApplicationError<ReportErrorType> {
    constructor(status: string) {
        super({
            message: `Unsupported report status: ${status}. Only COMPLETED and FAILED statuses are supported.`,
            code: 400,
            type: ReportErrorType.UNSUPPORTED_REPORT_STATUS,
        })
    }
}
