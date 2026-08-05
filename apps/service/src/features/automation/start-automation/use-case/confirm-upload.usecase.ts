import { Injectable, Inject, Logger } from "@nestjs/common"
import { Usecase } from "@/shared/interfaces/usecase"
import { IAutomationRepository } from "@/shared/repository/automation-repository.interface"
import { GetCompanyByIdUseCase } from "./get-company-by-id.usecase"
import { CheckCompanyHasProcessingAutomationUseCase } from "./check-company-has-processing-automation.usecase"
import { SaveDocumentsUseCase } from "./save-documents.usecase"
import { NotifyAgentWithDocumentsUseCase } from "./notify-agent-with-documents.usecase"
import { AutomationStatus } from "@/shared/domain/entities/automation.entity"

export interface ConfirmUploadFile {
    fileName: string
    gcsPath: string
}

export interface ConfirmUploadInput {
    automationId: string
    companyId: string
    files: ConfirmUploadFile[]
}

export interface ConfirmUploadOutput {
    automationId: string
    status: string
}

@Injectable()
export class ConfirmUploadUseCase
    implements Usecase<ConfirmUploadInput, ConfirmUploadOutput> {
    private readonly logger = new Logger(ConfirmUploadUseCase.name)

    constructor(
        @Inject("AutomationRepository")
        private readonly automationRepository: IAutomationRepository,
        private readonly getCompanyByIdUseCase: GetCompanyByIdUseCase,
        private readonly checkCompanyHasProcessingAutomationUseCase: CheckCompanyHasProcessingAutomationUseCase,
        private readonly saveDocumentsUseCase: SaveDocumentsUseCase,
        private readonly notifyAgentWithDocumentsUseCase: NotifyAgentWithDocumentsUseCase,
    ) { }

    async execute(input: ConfirmUploadInput): Promise<ConfirmUploadOutput> {
        const { automationId, companyId, files } = input

        const { company } = await this.getCompanyByIdUseCase.execute({ companyId })
        await this.checkCompanyHasProcessingAutomationUseCase.execute({ companyId })

        const automation = await this.automationRepository.create({
            id: automationId,
            companyId,
            status: AutomationStatus.PENDING,
        })

        this.logger.log(`Persisted automation ${automation.id} for company ${companyId}`)

        const uploadedFiles = files.map(f => ({
            url: f.gcsPath,
            path: f.gcsPath,
            name: f.fileName,
        }))

        const { documents } = await this.saveDocumentsUseCase.execute({
            automationId: automation.id,
            uploadedFiles,
        })

        this.logger.log(`Saved ${documents.length} documents for automation ${automation.id}`)

        const agentDocuments = documents.map(doc => ({
            id: doc.id,
            url: doc.bucketPath,
        }))

        await this.notifyAgentWithDocumentsUseCase.execute({
            automation,
            companyName: company.name,
            documents: agentDocuments,
        })

        this.logger.log(`Notified agent for automation ${automation.id}`)

        return {
            automationId: automation.id,
            status: AutomationStatus.PROCESSING,
        }
    }
}
