import { Injectable, Inject, Logger } from "@nestjs/common"
import { StorageService } from "@/shared/services/storage.service"
import { Usecase } from "@/shared/interfaces/usecase"
import { File as MulterFile } from "multer"
import { DataroomZipFolderFactory } from "@/shared/domain/factories/dataroom-zip-folder.factory"
import { UploadedFile } from "@/shared/services/storage.service"
import { mapUploadedFilesToDocuments } from "../helpers/map-uploaded-files-to-documents.helper"
import { ZipParserService } from "@/shared/services/zip-parser.service"

export interface AutomationZipUploadInput {
    enterpriseName: string
    automationId: string
    zipFile: MulterFile
}

export interface UploadedDocument {
    url: string
}

export interface AutomationZipUploadOutput {
    documents: UploadedDocument[]
    uploadedFiles: UploadedFile[]
}

@Injectable()
export class AutomationZipUploadUseCase implements Usecase<
    AutomationZipUploadInput,
    AutomationZipUploadOutput
> {
    private readonly zipFolderFactory: DataroomZipFolderFactory

    constructor(
        @Inject("StorageService")
        private readonly storage: StorageService,
        @Inject("ZipParserService")
        private readonly zipParserService: ZipParserService,
    ) {
        this.zipFolderFactory = new DataroomZipFolderFactory(zipParserService)
    }

    async execute(
        input: AutomationZipUploadInput,
    ): Promise<AutomationZipUploadOutput> {
        const { enterpriseName, automationId, zipFile } = input

        Logger.debug("Uploading ZIP file to storage", {
            zipFile,
        })

        const folderName = `${enterpriseName}/${automationId}`

        const folder = await this.zipFolderFactory.createFromZipBuffer(
            folderName,
            zipFile.buffer,
        )

        Logger.debug("ZIP file uploaded to storage", {
            folderName,
            folder,
        })

        // Upload para storage with automation-specific folder
        const uploadedFiles: UploadedFile[] =
            await this.storage.uploadFolderOnEnterpriseRoot(folderName, folder)

        // Mapear para documentos
        const documents = mapUploadedFilesToDocuments(uploadedFiles)

        return { documents, uploadedFiles }
    }
}
