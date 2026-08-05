import { ApplicationError, ValidationError } from "@/shared/errors/errors"
import { ValidationErrorDescription } from "@/shared/errors/types"

export enum CompanyErrorType {
    COMPANY_NOT_FOUND = "COMPANY_NOT_FOUND",
    COMPANY_ALREADY_EXISTS = "COMPANY_ALREADY_EXISTS",
    INVALID_COMPANY_DATA = "INVALID_COMPANY_DATA",
    COMPANY_CREATION_FAILED = "COMPANY_CREATION_FAILED",
    COMPANY_UPDATE_FAILED = "COMPANY_UPDATE_FAILED",
    COMPANY_DELETION_FAILED = "COMPANY_DELETION_FAILED",
    COMPANY_ACCESS_DENIED = "COMPANY_ACCESS_DENIED",
    COMPANY_VALIDATION_ERROR = "COMPANY_VALIDATION_ERROR",
    COMPANY_NAME_ALREADY_EXISTS = "COMPANY_NAME_ALREADY_EXISTS",
    COMPANY_CNPJ_ALREADY_EXISTS = "COMPANY_CNPJ_ALREADY_EXISTS",
    COMPANY_EMAIL_ALREADY_EXISTS = "COMPANY_EMAIL_ALREADY_EXISTS",
    COMPANY_INACTIVE = "COMPANY_INACTIVE",
    COMPANY_SUSPENDED = "COMPANY_SUSPENDED",
    ONE_PAGER_NOT_FOUND = "ONE_PAGER_NOT_FOUND",
    ONE_PAGER_DOWNLOAD_FAILED = "ONE_PAGER_DOWNLOAD_FAILED",
    ONE_PAGER_PARSE_FAILED = "ONE_PAGER_PARSE_FAILED",
    ONE_PAGER_INVALID_FORMAT = "ONE_PAGER_INVALID_FORMAT",
    AUTOMATION_NOT_COMPLETED = "AUTOMATION_NOT_COMPLETED",
}

export class CompanyNotFoundError extends ApplicationError<CompanyErrorType> {
    constructor() {
        super({
            message: `Company  not found`,
            code: 404,
            type: CompanyErrorType.COMPANY_NOT_FOUND,
        })
    }
}

export class CompanyAlreadyExistsError extends ApplicationError<CompanyErrorType> {
    constructor(identifier?: string) {
        super({
            message: identifier
                ? `Company with identifier ${identifier} already exists`
                : "Company already exists",
            code: 409,
            type: CompanyErrorType.COMPANY_ALREADY_EXISTS,
        })
    }
}

export class InvalidCompanyDataError extends ApplicationError<CompanyErrorType> {
    constructor(message: string = "Invalid company data provided") {
        super({
            message,
            code: 400,
            type: CompanyErrorType.INVALID_COMPANY_DATA,
        })
    }
}

export class CompanyCreationFailedError extends ApplicationError<CompanyErrorType> {
    constructor(reason?: string) {
        super({
            message: `Failed to create company${reason ? `: ${reason}` : ""}`,
            code: 500,
            type: CompanyErrorType.COMPANY_CREATION_FAILED,
        })
    }
}

export class CompanyUpdateFailedError extends ApplicationError<CompanyErrorType> {
    constructor(companyId?: string, reason?: string) {
        super({
            message: `Failed to update company${companyId ? ` with ID ${companyId}` : ""}${reason ? `: ${reason}` : ""}`,
            code: 500,
            type: CompanyErrorType.COMPANY_UPDATE_FAILED,
        })
    }
}

export class CompanyDeletionFailedError extends ApplicationError<CompanyErrorType> {
    constructor(companyId?: string, reason?: string) {
        super({
            message: `Failed to delete company${companyId ? ` with ID ${companyId}` : ""}${reason ? `: ${reason}` : ""}`,
            code: 500,
            type: CompanyErrorType.COMPANY_DELETION_FAILED,
        })
    }
}

export class CompanyAccessDeniedError extends ApplicationError<CompanyErrorType> {
    constructor(companyId?: string, action?: string) {
        super({
            message: `Access denied${companyId ? ` to company ${companyId}` : ""}${action ? ` for action: ${action}` : ""}`,
            code: 403,
            type: CompanyErrorType.COMPANY_ACCESS_DENIED,
        })
    }
}

export class CompanyValidationError extends ValidationError<CompanyErrorType> {
    constructor(errors: ValidationErrorDescription[]) {
        super({
            message: "Company validation error",
            code: 400,
            type: CompanyErrorType.COMPANY_VALIDATION_ERROR,
            errors,
        })
    }
}

export class CompanyNameAlreadyExistsError extends ApplicationError<CompanyErrorType> {
    constructor() {
        super({
            message: `Company with name already registered`,
            code: 409,
            type: CompanyErrorType.COMPANY_NAME_ALREADY_EXISTS,
        })
    }
}

export class CompanyCNPJAlreadyExistsError extends ApplicationError<CompanyErrorType> {
    constructor(cnpj: string) {
        super({
            message: `Company with CNPJ "${cnpj}" already exists`,
            code: 409,
            type: CompanyErrorType.COMPANY_CNPJ_ALREADY_EXISTS,
        })
    }
}

export class CompanyEmailAlreadyExistsError extends ApplicationError<CompanyErrorType> {
    constructor(email: string) {
        super({
            message: `Company with email "${email}" already exists`,
            code: 409,
            type: CompanyErrorType.COMPANY_EMAIL_ALREADY_EXISTS,
        })
    }
}

export class CompanyInactiveError extends ApplicationError<CompanyErrorType> {
    constructor(companyId?: string) {
        super({
            message: companyId
                ? `Company with ID ${companyId} is inactive`
                : "Company is inactive",
            code: 400,
            type: CompanyErrorType.COMPANY_INACTIVE,
        })
    }
}

export class CompanySuspendedError extends ApplicationError<CompanyErrorType> {
    constructor(companyId?: string, reason?: string) {
        super({
            message: `Company${companyId ? ` with ID ${companyId}` : ""} is suspended${reason ? `: ${reason}` : ""}`,
            code: 403,
            type: CompanyErrorType.COMPANY_SUSPENDED,
        })
    }
}

export class OnePagerNotFoundError extends ApplicationError<CompanyErrorType> {
    constructor(companyId: string) {
        super({
            message: `No one-pager found for company ${companyId}. Ensure the company has at least one completed automation with a one-pager.`,
            code: 404,
            type: CompanyErrorType.ONE_PAGER_NOT_FOUND,
        })
    }
}

export class OnePagerDownloadFailedError extends ApplicationError<CompanyErrorType> {
    constructor(filePath: string, reason?: string) {
        super({
            message: `Failed to download one-pager file from ${filePath}${reason ? `: ${reason}` : ""}`,
            code: 500,
            type: CompanyErrorType.ONE_PAGER_DOWNLOAD_FAILED,
        })
    }
}

export class OnePagerParseFailedError extends ApplicationError<CompanyErrorType> {
    constructor(fileName?: string, reason?: string) {
        super({
            message: `Failed to parse one-pager content${fileName ? ` from file ${fileName}` : ""}${reason ? `: ${reason}` : ""}`,
            code: 500,
            type: CompanyErrorType.ONE_PAGER_PARSE_FAILED,
        })
    }
}

export class OnePagerInvalidFormatError extends ApplicationError<CompanyErrorType> {
    constructor(fileName?: string) {
        super({
            message: `Invalid one-pager format${fileName ? ` in file ${fileName}` : ""}. Expected markdown content.`,
            code: 422,
            type: CompanyErrorType.ONE_PAGER_INVALID_FORMAT,
        })
    }
}

export class AutomationNotCompletedError extends ApplicationError<CompanyErrorType> {
    constructor(companyId: string) {
        super({
            message: `Company ${companyId} has no completed automations. One-pager is only available for completed automations.`,
            code: 422,
            type: CompanyErrorType.AUTOMATION_NOT_COMPLETED,
        })
    }
}