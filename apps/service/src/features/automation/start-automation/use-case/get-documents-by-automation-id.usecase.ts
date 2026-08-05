import { Injectable, Inject } from "@nestjs/common"
import { Usecase } from "@/shared/interfaces/usecase"
import { Document } from "@/shared/domain/entities/document.entity"
import { DocumentRepository } from "@/shared/repository/document-repository.interface"

export interface GetDocumentsByAutomationIdInput {
    automationId: string
}

export interface GetDocumentsByAutomationIdOutput {
    documents: Document[]
}

@Injectable()
export class GetDocumentsByAutomationIdUseCase
    implements Usecase<GetDocumentsByAutomationIdInput, GetDocumentsByAutomationIdOutput>
{
    constructor(
        @Inject("DocumentRepository")
        private readonly documentRepository: DocumentRepository,
    ) {}

    async execute(input: GetDocumentsByAutomationIdInput): Promise<GetDocumentsByAutomationIdOutput> {
        const { automationId } = input

        const documents = await this.documentRepository.findByAutomationId(automationId)

        return { documents }
    }
} 