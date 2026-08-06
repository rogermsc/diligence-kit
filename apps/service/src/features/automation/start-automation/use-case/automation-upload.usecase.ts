import { Injectable, Inject } from "@nestjs/common"
import { StorageService } from "@/shared/services/storage.service"
import { Usecase } from "@/shared/interfaces/usecase"
import { File as MulterFile } from "multer"
import { DataroomFolderFactory } from "@/shared/domain/factories"
import { UploadedFile } from "@/shared/services/storage.service"
import { mapUploadedFilesToDocuments } from "../helpers/map-uploaded-files-to-documents.helper"

export interface AutomationUploadInput {
    enterpriseName: string
    files: Record<string, MulterFile[]>
}

export interface UploadedDocument {
    url: string
}

export interface AutomationUploadOutput {
    documents: UploadedDocument[]
    uploadedFiles: UploadedFile[]
}

@Injectable()
export class AutomationUploadUseCase implements Usecase<
    AutomationUploadInput,
    AutomationUploadOutput
> {
    constructor(
        @Inject("StorageService")
        private readonly storage: StorageService,
    ) {}

    async execute(
        input: AutomationUploadInput,
    ): Promise<AutomationUploadOutput> {
        const { enterpriseName, files } = input
        const folder = DataroomFolderFactory.createFromMulterFiles(
            enterpriseName,
            files,
        )
        const uploadedFiles: UploadedFile[] =
            await this.storage.uploadFolderOnEnterpriseRoot(
                enterpriseName,
                folder,
            )

        const documents = mapUploadedFilesToDocuments(uploadedFiles)

        return { documents, uploadedFiles }
    }
}
