import { ApplicationError } from "@/shared/errors/errors"

export enum InfraErrorType {
    DATABASE_ACCESS_ERROR = "DATABASE_ACCESS_ERROR",
    INVALID_UUID_ERROR = "INVALID_UUID_ERROR",
    RECORD_NOT_FOUND_ERROR = "RECORD_NOT_FOUND_ERROR",
    UNIQUE_CONSTRAINT_ERROR = "UNIQUE_CONSTRAINT_ERROR",
}

export class DatabaseAccessError extends ApplicationError<InfraErrorType> {
    constructor(message: string = "Failed to access the database") {
        super({
            message,
            code: 500,
            type: InfraErrorType.DATABASE_ACCESS_ERROR,
        })
    }
}

/**
 * Raised when an owner-scoped write matched no rows. Deliberately a 404 with no
 * detail: the record may exist and belong to someone else, and saying so would
 * confirm the existence of another tenant's data.
 */
export class RecordNotFoundError extends ApplicationError<InfraErrorType> {
    constructor(id: string) {
        super({
            message: `Record ${id} not found`,
            code: 404,
            type: InfraErrorType.RECORD_NOT_FOUND_ERROR,
        })
    }
}

/**
 * A company name collided with the global unique index. Names are globally
 * unique because storage paths are namespaced by them, so this is reachable by
 * a legitimate user picking a name another tenant already holds — which does
 * disclose that the name is taken. Namespacing storage by company id would
 * remove the constraint and the disclosure together.
 */
export class CompanyNameTakenError extends ApplicationError<InfraErrorType> {
    constructor() {
        super({
            message: "A company with this name already exists",
            code: 409,
            type: InfraErrorType.UNIQUE_CONSTRAINT_ERROR,
        })
    }
}

export class InvalidUUIDError extends ApplicationError<InfraErrorType> {
    constructor(uuid: string) {
        super({
            message: `ID fornecido não é um UUID válido: ${uuid}`,
            code: 400,
            type: InfraErrorType.INVALID_UUID_ERROR,
        })
    }
}
