import { Injectable, Inject } from "@nestjs/common"
import { Usecase } from "@/shared/interfaces/usecase"
import { Document } from "@/shared/domain/entities/document.entity"
import { DocumentRepository } from "@/shared/repository/document-repository.interface"
import { UploadedFile } from "@/shared/services/storage.service"
import { AutomationNotFoundError } from "@/features/automation/start-automation/domain/errors/automation-errors"
import { IAutomationRepository } from "@/shared/repository/automation-repository.interface"

export interface SaveDocumentsInput {
    automationId: string
    uploadedFiles: UploadedFile[]
}

export interface SaveDocumentsOutput {
    documents: Document[]
}

@Injectable()
export class SaveDocumentsUseCase
    implements Usecase<SaveDocumentsInput, SaveDocumentsOutput> {
    constructor(
        @Inject("DocumentRepository")
        private readonly documentRepository: DocumentRepository,
        @Inject("AutomationRepository")
        private readonly automationRepository: IAutomationRepository,
    ) { }

    async execute(input: SaveDocumentsInput): Promise<SaveDocumentsOutput> {
        const { automationId, uploadedFiles } = input

        if (!uploadedFiles || uploadedFiles.length === 0) {
            return { documents: [] }
        }

        const automation = await this.automationRepository.findById(automationId)

        if (!automation) {
            throw new AutomationNotFoundError()
        }

        const documentsData = uploadedFiles.map((file) => ({
            automationId,
            name: file.name,
            bucketPath: file.url,
        }))

        const documents =
            await this.documentRepository.createMany(documentsData)

        return { documents }
    }
}
