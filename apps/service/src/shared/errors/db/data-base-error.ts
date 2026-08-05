import { ApplicationError } from "@/shared/errors/errors"

export enum InfraErrorType {
    DATABASE_ACCESS_ERROR = "DATABASE_ACCESS_ERROR",
    INVALID_UUID_ERROR = "INVALID_UUID_ERROR",
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

export class InvalidUUIDError extends ApplicationError<InfraErrorType> {
    constructor(uuid: string) {
        super({
            message: `ID fornecido não é um UUID válido: ${uuid}`,
            code: 400,
            type: InfraErrorType.INVALID_UUID_ERROR,
        })
    }
}
