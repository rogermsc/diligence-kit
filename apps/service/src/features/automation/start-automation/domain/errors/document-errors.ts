import { ApplicationError } from "@/shared/errors/errors"

export class DocumentNotFoundError extends ApplicationError<"DOCUMENT_NOT_FOUND"> {
    constructor(documentId: string) {
        super({
            message: `Document with ID ${documentId} not found`,
            code: 404,
            type: "DOCUMENT_NOT_FOUND",
        })
    }
}

export class DocumentDownloadError extends ApplicationError<"DOCUMENT_DOWNLOAD_ERROR"> {
    constructor(message = "Failed to download document") {
        super({
            message,
            code: 500,
            type: "DOCUMENT_DOWNLOAD_ERROR",
        })
    }
} 