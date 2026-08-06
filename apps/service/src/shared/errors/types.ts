export enum ErrorType {
    VALIDATION_ERROR = "VALIDATION_ERROR",
    UNAUTHORIZED = "UNAUTHORIZED",
    FORBIDDEN = "FORBIDDEN",
    NOT_FOUND = "NOT_FOUND",
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
    BAD_REQUEST = "BAD_REQUEST",
    CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
    TIMEOUT_ERROR = "TIMEOUT_ERROR",
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
}

export interface BaseErrorType<T extends string = string> {
    message: string
    code: number
    type: T
    details?: unknown
}

export interface ValidationErrorDescription {
    code: string
    field: string
    message: string
}

export interface ValidationErrorType<
    T extends string = string,
> extends BaseErrorType<T> {
    errors: ValidationErrorDescription[]
}
