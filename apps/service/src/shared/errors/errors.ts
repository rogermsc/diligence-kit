import { ValidationErrorDescription } from "@/shared/errors/types"

interface ApplicationErrorProps<T> {
    message: string
    code: number
    type: T
}

interface ValidationErrorProps<T> extends ApplicationErrorProps<T> {
    errors: ValidationErrorDescription[]
}

export class ApplicationError<T> extends Error {
    readonly code: number
    readonly type: T

    constructor(props: ApplicationErrorProps<T>) {
        super(props.message)
        this.code = props.code
        this.type = props.type
    }

    toHttpResponse(): ApplicationErrorProps<T> {
        return {
            message: this.message,
            code: this.code,
            type: this.type,
        }
    }
}

export class ValidationError<T> extends ApplicationError<T> {
    readonly errors: ValidationErrorDescription[]

    constructor(props: ValidationErrorProps<T>) {
        super(props)
        this.errors = props.errors
    }

    toHttpResponse(): ValidationErrorProps<T> {
        return {
            message: this.message,
            code: this.code,
            type: this.type,
            errors: this.errors,
        }
    }
}
