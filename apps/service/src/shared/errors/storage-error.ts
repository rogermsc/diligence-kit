import { ApplicationError } from "@/shared/errors/errors"

export enum StorageErrorType {
    CREDENTIALS_ERROR = "CREDENTIALS_ERROR",
    BUCKET_ERROR = "BUCKET_ERROR",
    UPLOAD_ERROR = "UPLOAD_ERROR",
    UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export class StorageError extends ApplicationError<StorageErrorType> {
    constructor(type: StorageErrorType, message: string, code?: number) {
        super({
            message,
            code: code ?? StorageError.mapCode(type),
            type,
        })
    }

    private static mapCode(type: StorageErrorType): number {
        switch (type) {
            case StorageErrorType.CREDENTIALS_ERROR:
                return 401
            case StorageErrorType.BUCKET_ERROR:
                return 404
            case StorageErrorType.UPLOAD_ERROR:
                return 500
            default:
                return 500
        }
    }
}
