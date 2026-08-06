import { Injectable, Inject, Logger } from "@nestjs/common"
import { Usecase } from "@/shared/interfaces/usecase"
import { IAutomationRepository } from "@/shared/repository/automation-repository.interface"
import { GetCompanyByIdUseCase } from "./get-company-by-id.usecase"
import { CheckCompanyHasProcessingAutomationUseCase } from "./check-company-has-processing-automation.usecase"
import { SaveDocumentsUseCase } from "./save-documents.usecase"
import { NotifyAgentWithDocumentsUseCase } from "./notify-agent-with-documents.usecase"
import { AutomationStatus } from "@/shared/domain/entities/automation.entity"
import { BadRequestException } from "@nestjs/common"

class InvalidGcsPathError extends BadRequestException {
    constructor(fileName: string) {
        super(`Upload path for "${fileName}" is not valid for this automation`)
    }
}

/** Deliberately says nothing about who owns the conflicting automation. */
class AutomationAlreadyConfirmedError extends BadRequestException {
    constructor() {
        super("This upload has already been confirmed")
    }
}

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
export class ConfirmUploadUseCase implements Usecase<
    ConfirmUploadInput,
    ConfirmUploadOutput
> {
    private readonly logger = new Logger(ConfirmUploadUseCase.name)

    constructor(
        @Inject("AutomationRepository")
        private readonly automationRepository: IAutomationRepository,
        private readonly getCompanyByIdUseCase: GetCompanyByIdUseCase,
        private readonly checkCompanyHasProcessingAutomationUseCase: CheckCompanyHasProcessingAutomationUseCase,
        private readonly saveDocumentsUseCase: SaveDocumentsUseCase,
        private readonly notifyAgentWithDocumentsUseCase: NotifyAgentWithDocumentsUseCase,
    ) {}

    async execute(input: ConfirmUploadInput): Promise<ConfirmUploadOutput> {
        const { automationId, companyId, files } = input

        const { company } = await this.getCompanyByIdUseCase.execute({
            companyId,
        })
        await this.checkCompanyHasProcessingAutomationUseCase.execute({
            companyId,
        })

        // gcsPath arrives from the client and is persisted as Documents.bucketPath,
        // which the download endpoint later streams back verbatim. Unchecked, a
        // caller could name any object in the bucket — including another tenant's
        // dataroom — and read it back. Pin it to the prefix this automation's own
        // uploads produce (see GoogleStorageService.uploadSingleFile).
        const expectedPrefix = `gs://${process.env.GCLOUD_STORAGE_BUCKET}/${company.name}/${automationId}/`
        for (const file of files) {
            // startsWith is the whole check: GCS object names are flat strings,
            // so ".." carries no traversal meaning and rejecting it would fail
            // legitimate names like "FY2023..2024 financials.pdf".
            if (!file.gcsPath.startsWith(expectedPrefix)) {
                this.logger.warn(
                    `Rejected gcsPath outside automation ${automationId}: ${file.gcsPath}`,
                )
                throw new InvalidGcsPathError(file.fileName)
            }
        }

        // automationId comes from the URL, so a caller can name an id that already
        // exists — including another tenant's. Left to the DB, the primary-key
        // collision surfaced as a 500 while an unused id returned 200, which is a
        // cross-tenant existence oracle. Answer identically either way.
        const existing = await this.automationRepository.findById(automationId)
        if (existing) {
            throw new AutomationAlreadyConfirmedError()
        }

        const automation = await this.automationRepository.create({
            id: automationId,
            companyId,
            status: AutomationStatus.PENDING,
        })

        this.logger.log(
            `Persisted automation ${automation.id} for company ${companyId}`,
        )

        const uploadedFiles = files.map((f) => ({
            url: f.gcsPath,
            path: f.gcsPath,
            name: f.fileName,
        }))

        const { documents } = await this.saveDocumentsUseCase.execute({
            automationId: automation.id,
            uploadedFiles,
        })

        this.logger.log(
            `Saved ${documents.length} documents for automation ${automation.id}`,
        )

        const agentDocuments = documents.map((doc) => ({
            id: doc.id,
            url: doc.bucketPath,
        }))

        // The notify use case already writes FAILED and reports it when the
        // agent call throws. Hardcoding PROCESSING here threw that away, so a
        // run that never started showed as in progress and sat there until the
        // reaper timed it out.
        const { agentResponse } =
            await this.notifyAgentWithDocumentsUseCase.execute({
                automation,
                companyName: company.name,
                documents: agentDocuments,
            })

        this.logger.log(
            `Notified agent for automation ${automation.id}: ${agentResponse.status}`,
        )

        return {
            automationId: automation.id,
            status: agentResponse.status,
        }
    }
}
