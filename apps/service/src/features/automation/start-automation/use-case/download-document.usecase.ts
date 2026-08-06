import { Injectable, Inject } from "@nestjs/common"
import { Usecase } from "@/shared/interfaces/usecase"
import { DocumentRepository } from "@/shared/repository/document-repository.interface"
import { StorageService } from "@/shared/services/storage.service"
import { DocumentNotFoundError } from "../domain/errors/document-errors"

export interface DownloadDocumentInput {
    documentId: string
}

export interface DownloadDocumentOutput {
    fileName: string
    fileBuffer: Buffer
    mimeType: string
}

@Injectable()
export class DownloadDocumentUseCase implements Usecase<
    DownloadDocumentInput,
    DownloadDocumentOutput
> {
    constructor(
        @Inject("DocumentRepository")
        private readonly documentRepository: DocumentRepository,
        @Inject("StorageService")
        private readonly storageService: StorageService,
    ) {}

    async execute(
        input: DownloadDocumentInput,
    ): Promise<DownloadDocumentOutput> {
        const { documentId } = input

        // Get document metadata from database
        const document = await this.documentRepository.findById(documentId)

        if (!document) {
            throw new DocumentNotFoundError(documentId)
        }

        // Download file from storage
        const fileBuffer = await this.storageService.downloadFile(
            document.bucketPath,
        )

        // Determine MIME type from file extension
        const mimeType = this.getMimeTypeFromFileName(document.name)

        return {
            fileName: document.name,
            fileBuffer,
            mimeType,
        }
    }

    private getMimeTypeFromFileName(fileName: string): string {
        const extension = fileName.split(".").pop()?.toLowerCase()

        const mimeTypes: Record<string, string> = {
            pdf: "application/pdf",
            doc: "application/msword",
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            xls: "application/vnd.ms-excel",
            xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            txt: "text/plain",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            gif: "image/gif",
        }

        return mimeTypes[extension || ""] || "application/octet-stream"
    }
}
