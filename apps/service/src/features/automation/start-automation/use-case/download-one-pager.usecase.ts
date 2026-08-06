import { Injectable, Inject, Logger } from "@nestjs/common"
import { Usecase } from "@/shared/interfaces/usecase"
import { StorageService } from "@/shared/services/storage.service"
import { IAutomationRepository } from "@/shared/repository/automation-repository.interface"
import { CompanyRepository } from "@/shared/repository/company-repository.interface"
import {
    AutomationNotFoundError,
    OnePagerNotFoundError,
    AutomationNotCompletedError,
} from "../domain/errors/automation-errors"

export interface DownloadOnePagerInput {
    automationId: string
}

export interface DownloadOnePagerOutput {
    fileName: string
    fileBuffer: Buffer
    mimeType: string
}

@Injectable()
export class DownloadOnePagerUseCase implements Usecase<
    DownloadOnePagerInput,
    DownloadOnePagerOutput
> {
    private readonly logger = new Logger(DownloadOnePagerUseCase.name)

    constructor(
        @Inject("AutomationRepository")
        private readonly automationRepository: IAutomationRepository,
        @Inject("CompanyRepository")
        private readonly companyRepository: CompanyRepository,
        @Inject("StorageService")
        private readonly storageService: StorageService,
    ) {}

    async execute(
        input: DownloadOnePagerInput,
    ): Promise<DownloadOnePagerOutput> {
        const { automationId } = input

        // Buscar a automação
        const automation =
            await this.automationRepository.findById(automationId)
        if (!automation) {
            throw new AutomationNotFoundError()
        }

        // Verificar se a automação está completa
        if (automation.status !== "COMPLETED") {
            throw new AutomationNotCompletedError(automationId)
        }

        // Buscar o onePager da automação
        const onePager =
            await this.automationRepository.findOnePagerByAutomationId(
                automationId,
            )

        if (!onePager) {
            throw new OnePagerNotFoundError(automationId)
        }

        const onePagerUrl = onePager.url

        // Log para auditoria
        this.logger.log(
            `Downloading one-pager for automation ${automationId}`,
            {
                automationId,
                filePath: onePagerUrl,
                timestamp: new Date().toISOString(),
            },
        )

        // Fazer download do arquivo do Google Cloud Storage
        const fileBuffer = await this.storageService.downloadFile(onePagerUrl)

        // Extrair nome do arquivo da URL
        const fileName = this.extractFileNameFromUrl(onePagerUrl)

        // Determinar MIME type baseado na extensão
        const mimeType = this.getMimeTypeFromFileName(fileName)

        return {
            fileName,
            fileBuffer,
            mimeType,
        }
    }

    private extractFileNameFromUrl(url: string): string {
        // Extrair nome do arquivo da URL do Google Cloud Storage
        // Exemplo: gs://bucket/path/file.docx -> file.docx
        const parts = url.split("/")
        return parts[parts.length - 1] || "one_pager.docx"
    }

    private getMimeTypeFromFileName(fileName: string): string {
        const extension = fileName.split(".").pop()?.toLowerCase()

        const mimeTypes: Record<string, string> = {
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            doc: "application/msword",
            pdf: "application/pdf",
            txt: "text/plain",
        }

        return mimeTypes[extension || ""] || "application/octet-stream"
    }
}
