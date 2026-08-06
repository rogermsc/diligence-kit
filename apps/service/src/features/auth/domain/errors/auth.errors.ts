import { ApplicationError, ValidationError } from "@/shared/errors/errors"
import { ValidationErrorDescription } from "@/shared/errors/types"

export enum AuthErrorType {
    UNAUTHORIZED_CLIENT_ID = "UNAUTHORIZED_CLIENT_ID",
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
    FORBIDDEN = "FORBIDDEN",
    TOKEN_EXPIRED = "TOKEN_EXPIRED",
    MISSING_AUTH_HEADER = "MISSING_AUTH_HEADER",
    UNAUTHORIZED = "UNAUTHORIZED",
    VALIDATION_ERROR = "AUTH_VALIDATION_ERROR",
    USER_ALREADY_EXISTS = "USER_ALREADY_EXISTS",
    TOO_MANY_LOGIN_ATTEMPTS = "TOO_MANY_LOGIN_ATTEMPTS",
}

export class UnauthorizedClientError extends ApplicationError<AuthErrorType> {
    constructor() {
        super({
            message: "Unauthorized Client ID",
            code: 401,
            type: AuthErrorType.UNAUTHORIZED_CLIENT_ID,
        })
    }
}

export class InvalidCredentialsError extends ApplicationError<AuthErrorType> {
    constructor() {
        super({
            message: "Invalid credentials",
            code: 401,
            type: AuthErrorType.INVALID_CREDENTIALS,
        })
    }
}

export class ForbiddenError extends ApplicationError<AuthErrorType> {
    constructor(_resource?: string) {
        super({
            message: "Access denied",
            code: 403,
            type: AuthErrorType.FORBIDDEN,
        })
    }
}

export class TokenExpiredError extends ApplicationError<AuthErrorType> {
    constructor() {
        super({
            message: "Authentication token has expired",
            code: 401,
            type: AuthErrorType.TOKEN_EXPIRED,
        })
    }
}

export class MissingAuthHeaderError extends ApplicationError<AuthErrorType> {
    constructor() {
        super({
            message: "Authentication header not found",
            code: 401,
            type: AuthErrorType.MISSING_AUTH_HEADER,
        })
    }
}

export class UnauthorizedError extends ApplicationError<AuthErrorType> {
    constructor(message: string = "Unauthorized") {
        super({
            message,
            code: 401,
            type: AuthErrorType.UNAUTHORIZED,
        })
    }
}

export class AuthValidationError extends ValidationError<AuthErrorType> {
    constructor(errors: ValidationErrorDescription[]) {
        super({
            message: "Authentication validation error",
            code: 400,
            type: AuthErrorType.VALIDATION_ERROR,
            errors,
        })
    }
}

export class UserAlreadyExistsError extends ApplicationError<AuthErrorType> {
    constructor() {
        super({
            message: `The email you have provided is already associated with an account.`,
            code: 409,
            type: AuthErrorType.USER_ALREADY_EXISTS,
        })
    }
}

export class TooManyLoginAttemptsError extends ApplicationError<AuthErrorType> {
    readonly minutesLeft?: number
    readonly blockMilliseconds?: number
    constructor(minutesLeft?: number, blockMilliseconds?: number) {
        super({
            message:
                "Too many login attempts. Please try again later." +
                (minutesLeft ? ` Blocked for ${minutesLeft} minute(s).` : ""),
            code: 429,
            type: AuthErrorType.TOO_MANY_LOGIN_ATTEMPTS,
        })
        this.minutesLeft = minutesLeft
        this.blockMilliseconds = blockMilliseconds
    }
}
