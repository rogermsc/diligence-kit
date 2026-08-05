import { Injectable, Inject, Logger } from "@nestjs/common"
import { Usecase } from "@/shared/interfaces/usecase"
import { StorageService } from "@/shared/services/storage.service"
import { IAutomationRepository } from "@/shared/repository/automation-repository.interface"
import { ReportRepository } from "@/shared/repository/report-repository.interface"
import { AutomationNotFoundError } from "../domain/errors/automation-errors"
import { ReportNotFoundError } from "@/shared/errors/report-errors"
import { AgentType } from "@/features/onePager-agent/agent/domain/agent-type"

export interface DownloadReportInput {
    automationId: string
}

export interface DownloadReportOutput {
    fileName: string
    fileBuffer: Buffer
    mimeType: string
    domain: AgentType
    reportId: string
}

@Injectable()
export class DownloadReportUseCase
    implements Usecase<DownloadReportInput, DownloadReportOutput> {
    private readonly logger = new Logger(DownloadReportUseCase.name)

    constructor(
        @Inject("AutomationRepository")
        private readonly automationRepository: IAutomationRepository,
        @Inject("ReportRepository")
        private readonly reportRepository: ReportRepository,
        @Inject("StorageService")
        private readonly storageService: StorageService,
    ) { }

    async execute(input: DownloadReportInput): Promise<DownloadReportOutput> {
        const { automationId } = input

        this.logger.log(`Downloading report for automation ${automationId}`, {
            automationId
        })

        // Buscar a automação para validar
        const automation = await this.automationRepository.findById(automationId)

        if (!automation) {
            throw new AutomationNotFoundError()
        }

        const reports = await this.reportRepository.findByAutomationId(automationId)

        const isReportNotFound = !reports || reports.length === 0;

        if (isReportNotFound) {
            throw new ReportNotFoundError(automationId)
        }

        const latestReport = reports[0]

        const reportUrl = latestReport.getReportUrl()

        // Log para auditoria
        this.logger.log(`Downloading report file for automation ${automationId}`, {
            automationId,
            reportId: latestReport.getId(),
            domain: latestReport.getDomain(),
            reportUrl,
            timestamp: new Date().toISOString()
        })

        // Fazer download do arquivo do storage
        const fileBuffer = await this.storageService.downloadFile(reportUrl)

        const fileName = this.extractFileNameFromUrl(reportUrl, latestReport.getDomain())

        const mimeType = this.getMimeTypeFromFileName(fileName)

        return {
            fileName,
            fileBuffer,
            mimeType,
            domain: latestReport.getDomain(),
            reportId: latestReport.getId()
        }
    }

    private extractFileNameFromUrl(url: string, domain: AgentType): string {
        const parts = url.split('/')
        let fileName = parts[parts.length - 1] || `${domain.toLowerCase()}_report.pdf`

        if (!fileName.includes('.')) {
            fileName += '.pdf'
        }

        return fileName
    }

    private getMimeTypeFromFileName(fileName: string): string {
        const extension = fileName.split('.').pop()?.toLowerCase()

        const mimeTypes: Record<string, string> = {
            pdf: "application/pdf",
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            doc: "application/msword",
            xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            xls: "application/vnd.ms-excel",
            txt: "text/plain",
            html: "text/html",
            json: "application/json"
        }

        return mimeTypes[extension || ""] || "application/octet-stream"
    }
}
