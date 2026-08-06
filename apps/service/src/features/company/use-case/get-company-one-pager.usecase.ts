import { Injectable, Inject } from "@nestjs/common"
import { Usecase } from "@/shared/interfaces/usecase"
import { StorageService } from "@/shared/services/storage.service"
import { IAutomationRepository } from "@/shared/repository/automation-repository.interface"
import {
    AutomationStageDomain,
    AutomationStatus,
} from "@/shared/domain/entities/automation.entity"
import {
    OnePagerNotFoundError,
    OnePagerDownloadFailedError,
} from "@/features/company/domain/errors/company-errors"
import {
    AutomationNotFoundError,
    InvalidAutomationStageError,
} from "@/features/report-agents/domain/errors/report-agent.errors"

export interface GetCompanyOnePagerInput {
    id: string // ID da automação de triagem
}

export interface GetCompanyOnePagerOutput {
    fileName: string
    fileBuffer: Buffer
    mimeType: string
}

@Injectable()
export class GetCompanyOnePagerUseCase implements Usecase<
    GetCompanyOnePagerInput,
    GetCompanyOnePagerOutput
> {
    constructor(
        @Inject("AutomationRepository")
        private readonly automationRepository: IAutomationRepository,
        @Inject("StorageService")
        private readonly storageService: StorageService,
    ) {}

    async execute(
        input: GetCompanyOnePagerInput,
    ): Promise<GetCompanyOnePagerOutput> {
        // Verificar se a automação existe
        const automation = await this.automationRepository.findById(input.id)

        if (!automation) {
            throw new AutomationNotFoundError()
        }

        const isAutomationCompleted =
            automation.status === AutomationStatus.COMPLETED

        const isAutomationTriage =
            automation.stage === AutomationStageDomain.TRIAGE

        const isValidTriageAutomation =
            isAutomationCompleted && isAutomationTriage

        if (!isValidTriageAutomation) {
            throw new InvalidAutomationStageError()
        }

        const onePager =
            await this.automationRepository.findOnePagerByAutomationId(input.id)

        if (!onePager) {
            throw new OnePagerNotFoundError(input.id)
        }

        try {
            // Fazer download do PDF do storage
            const fileBuffer = await this.storageService.downloadFile(
                onePager.url,
            )

            // Extrair nome do arquivo da URL
            const fileName = this.extractFileNameFromUrl(onePager.url)

            // Determinar MIME type
            const mimeType = this.getMimeTypeFromFileName(fileName)

            return {
                fileName,
                fileBuffer,
                mimeType,
            }
        } catch (error) {
            throw new OnePagerDownloadFailedError(onePager.url, error.message)
        }
    }

    private extractFileNameFromUrl(url: string): string {
        // Extrair nome do arquivo da URL do Google Cloud Storage
        // Exemplo: gs://bucket/path/file.pdf -> file.pdf
        const parts = url.split("/")
        return parts[parts.length - 1] || "one-pager.pdf"
    }

    private getMimeTypeFromFileName(fileName: string): string {
        const extension = fileName.split(".").pop()?.toLowerCase()

        const mimeTypes: Record<string, string> = {
            pdf: "application/pdf",
            doc: "application/msword",
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }

        return mimeTypes[extension || ""] || "application/pdf"
    }
}
