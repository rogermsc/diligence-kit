import {
    Controller,
    Post,
    Get,
    UploadedFile,
    Param,
    ParseUUIDPipe,
    Query,
    UseInterceptors,
    StreamableFile,
    UseGuards,
    Logger,
    Body,
    Inject,
    Res,
    NotFoundException,
    BadRequestException,
} from "@nestjs/common"
import { Response } from "express"
import { FileInterceptor } from "@nestjs/platform-express"
import { File as MulterFile } from "multer"
import { GetDocumentsByAutomationIdUseCase } from "../use-case/get-documents-by-automation-id.usecase"
import { DownloadDocumentUseCase } from "../use-case/download-document.usecase"
import { DownloadOnePagerUseCase } from "../use-case/download-one-pager.usecase"
import { DownloadReportUseCase } from "../use-case/download-report.usecase"
import { CreateAutomationUseCase } from "../use-case/create-automation.usecase"
import { UploadDocumentUseCase } from "../use-case/upload-document.usecase"
import { ConfirmUploadUseCase } from "../use-case/confirm-upload.usecase"
import { GetCompanyByIdUseCase } from "../use-case/get-company-by-id.usecase"
import { AutomationRepository } from "../domain/repository/automation-repository.interface"
import { Tenancy } from "@/shared/tenancy/tenancy.decorator"
import { RequestValidator } from "@/shared/validators/request-validator"
import {
    ConfirmUploadDto,
    ConfirmUploadSchema,
} from "../data/dtos/confirm-upload.schema"
import { DocumentRepository } from "@/shared/repository/document-repository.interface"
import { AgentGateway } from "../gateway/agent-gateway.interface"
import {
    AutomationStatus,
    AutomationStageDomain,
} from "@/shared/domain/entities/automation.entity"
import { AuthGuard } from "@/features/auth/guards/auth.guard"
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger"
import {
    ApiDownloadDocument,
    ApiDownloadOnePager,
    ApiDownloadReport,
    ApiGetDocumentsByAutomationId,
} from "@/shared/decorators"
@ApiTags("Automation")
@ApiBearerAuth("access-token")
@Controller("automation")
@UseGuards(AuthGuard)
export class AutomationController {
    private readonly logger = new Logger(AutomationController.name)

    constructor(
        private readonly getDocumentsByAutomationIdUseCase: GetDocumentsByAutomationIdUseCase,
        private readonly downloadDocumentUseCase: DownloadDocumentUseCase,
        private readonly downloadOnePagerUseCase: DownloadOnePagerUseCase,
        private readonly downloadReportUseCase: DownloadReportUseCase,
        private readonly createAutomationUseCase: CreateAutomationUseCase,
        private readonly uploadDocumentUseCase: UploadDocumentUseCase,
        private readonly confirmUploadUseCase: ConfirmUploadUseCase,
        private readonly getCompanyByIdUseCase: GetCompanyByIdUseCase,
        @Inject("AutomationRepository")
        private readonly automationRepository: AutomationRepository,
        @Inject("DocumentRepository")
        private readonly documentRepository: DocumentRepository,
        @Inject("AgentGateway")
        private readonly agentGateway: AgentGateway,
    ) {}

    @Post("create/:companyId")
    @Tenancy({ company: "param:companyId" })
    async createAutomation(
        @Param("companyId", new ParseUUIDPipe()) companyId: string,
    ) {
        return this.createAutomationUseCase.execute({ companyId })
    }

    @Post(":automationId/upload-document")
    // From the query string, not the body: this route is multipart, and multer
    // runs as a method-scoped interceptor — after the global tenancy check — so
    // a `body:` source here reads undefined and rejects every upload.
    @Tenancy({ company: "query:companyId" })
    @UseInterceptors(
        FileInterceptor("file", { limits: { fileSize: 100 * 1024 * 1024 } }),
    )
    async uploadDocument(
        @Param("automationId", new ParseUUIDPipe()) automationId: string,
        @Query("companyId", new ParseUUIDPipe()) companyId: string,
        @UploadedFile() file: MulterFile,
    ) {
        // The automation row is only persisted at the confirm step, so it does
        // not exist yet during create/upload — authorize against the company,
        // which does exist, instead of the automation.
        return this.uploadDocumentUseCase.execute({
            automationId,
            companyId,
            file: {
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                buffer: file.buffer,
            },
        })
    }

    @Post(":automationId/confirm")
    @Tenancy({ company: "body:companyId" })
    async confirmUpload(
        @Param("automationId", new ParseUUIDPipe()) automationId: string,
        @Body() body: unknown,
    ) {
        // This handler previously took the body as a bare type assertion with no
        // runtime validation, unlike every other controller here.
        const input = RequestValidator.validate<ConfirmUploadDto>(
            body,
            ConfirmUploadSchema,
        )

        // confirm is the step that actually persists the automation row, so it
        // must not require the automation to already exist — authorize against
        // the company instead.

        return this.confirmUploadUseCase.execute({
            automationId,
            companyId: input.companyId,
            files: input.files,
        })
    }

    @Get(":automationId/documents")
    @Tenancy({ automation: "param:automationId" })
    @ApiGetDocumentsByAutomationId()
    async getDocumentsByAutomationId(
        @Param("automationId", new ParseUUIDPipe()) automationId: string,
    ) {
        const result = await this.getDocumentsByAutomationIdUseCase.execute({
            automationId,
        })

        return {
            documents: result.documents,
        }
    }

    @Get("documents/:documentId/download")
    @Tenancy({ document: "param:documentId" })
    @ApiDownloadDocument()
    async downloadDocument(
        @Param("documentId", new ParseUUIDPipe()) documentId: string,
    ): Promise<StreamableFile> {
        // This already 404s with the same message when the row is absent or is
        // not the caller's, and DownloadDocumentUseCase reads the row itself —
        // so an extra fetch here would be a dead round trip per download.

        const result = await this.downloadDocumentUseCase.execute({
            documentId,
        })

        return new StreamableFile(result.fileBuffer)
    }

    @Get(":automationId/download-one-pager")
    @Tenancy({ automation: "param:automationId" })
    @ApiDownloadOnePager()
    async downloadOnePager(
        @Param("automationId", new ParseUUIDPipe()) automationId: string,
    ): Promise<StreamableFile> {
        const result = await this.downloadOnePagerUseCase.execute({
            automationId,
        })
        return new StreamableFile(result.fileBuffer)
    }

    @Get(":automationId/download-report")
    @Tenancy({ automation: "param:automationId" })
    @ApiDownloadReport()
    async downloadReport(
        @Param("automationId", new ParseUUIDPipe()) automationId: string,
        @Res() res: Response,
    ) {
        const { fileName, fileBuffer, mimeType } =
            await this.downloadReportUseCase.execute({
                automationId,
            })

        res.set({
            "Content-Type": mimeType,
            "Content-Disposition": `attachment; filename="${fileName}"`,
            "Content-Length": fileBuffer.length,
        })

        res.send(fileBuffer)
    }

    @Post(":automationId/retry")
    @Tenancy({ automation: "param:automationId" })
    async retryAutomation(
        @Param("automationId", new ParseUUIDPipe()) automationId: string,
    ) {
        this.logger.log(`Retry requested for automation ${automationId}`)

        const automation =
            await this.automationRepository.findById(automationId)
        if (!automation) {
            throw new NotFoundException(`Automation ${automationId} not found`)
        }

        if (automation.status !== AutomationStatus.FAILED) {
            throw new BadRequestException(
                `Automation ${automationId} is not in FAILED status`,
            )
        }

        if (automation.stage !== AutomationStageDomain.TRIAGE) {
            throw new BadRequestException(
                `Only TRIAGE automations can be retried`,
            )
        }

        const { company } = await this.getCompanyByIdUseCase.execute({
            companyId: automation.companyId,
        })

        const documents =
            await this.documentRepository.findByAutomationId(automationId)
        const agentDocuments = documents.map((doc) => ({
            id: doc.id,
            // bucketPath is already a full gs:// URI — prefixing it again
            // produced gs://bucket/gs://bucket/..., which resolves to nothing.
            // The agent then completed the retry on zero documents and
            // reported success.
            url: doc.bucketPath,
        }))

        await this.automationRepository.updateStatus(
            automationId,
            AutomationStatus.PROCESSING,
        )

        try {
            await this.agentGateway.startAgentAutomation({
                company_name: company.name,
                company_id: automation.companyId,
                automation_id: automationId,
                documents: agentDocuments,
                retry: true,
            })
        } catch (err) {
            // Revert to FAILED so the automation doesn't get stuck on PROCESSING
            // when the agent rejects the call (mirrors the confirm/notify flow).
            await this.automationRepository.updateStatus(
                automationId,
                AutomationStatus.FAILED,
            )
            this.logger.error(
                `Automation ${automationId} retry failed to start with the agent`,
                (err as Error)?.stack || err,
            )
            throw err
        }

        this.logger.log(`Automation ${automationId} retry started`)
        return { automationId, status: "PROCESSING" }
    }
}
