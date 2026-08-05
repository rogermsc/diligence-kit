import {
    Controller,
    Post,
    Get,
    UploadedFile,
    Param,
    ParseUUIDPipe,
    UseInterceptors,
    StreamableFile,
    UseGuards,
    Headers,
    Logger,
    Body,
    Inject,
    Req,
    Res,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { File as MulterFile } from 'multer';
import { AutomationRequest } from '../types/request.types';
import { EventBusPort } from '@/shared/domain/interfaces/event-bus.interface';
import { ChunkValidator } from '../services/chunk-validator.service';
import { AutomationOrchestrator } from '../services/automation-orchestrator.service';
import { ChunkRegistry } from '../infra/repositories/redis-chunk-registry.repository';
import { GetDocumentsByAutomationIdUseCase } from '../use-case/get-documents-by-automation-id.usecase';
import { DownloadDocumentUseCase } from '../use-case/download-document.usecase';
import { DownloadOnePagerUseCase } from '../use-case/download-one-pager.usecase';
import { DownloadReportUseCase } from '../use-case/download-report.usecase';
import { CreateAutomationUseCase } from '../use-case/create-automation.usecase';
import { UploadDocumentUseCase } from '../use-case/upload-document.usecase';
import { ConfirmUploadUseCase } from '../use-case/confirm-upload.usecase';
import { GetCompanyByIdUseCase } from '../use-case/get-company-by-id.usecase';
import { AutomationRepository } from '../domain/repository/automation-repository.interface';
import { DocumentRepository } from '@/shared/repository/document-repository.interface';
import { AgentGateway } from '../gateway/agent-gateway.interface';
import { AutomationStatus, AutomationStageDomain } from '@/shared/domain/entities/automation.entity';
import { AutomationIdInterceptor } from '../interceptors/automation-id.interceptor';
import { AuthGuard } from '@/features/auth/guards/auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ApiDownloadDocument, ApiDownloadOnePager, ApiDownloadReport, ApiGetDocumentsByAutomationId, ApiStartAutomation } from '@/shared/decorators';
@ApiTags('Automation')
@ApiBearerAuth('access-token')
@Controller('automation')
@UseGuards(AuthGuard)
export class AutomationController {
    private readonly logger = new Logger(AutomationController.name);

    constructor(
        @Inject('EventBusPort')
        private readonly eventBus: EventBusPort,
        private readonly chunkValidator: ChunkValidator,
        private readonly automationOrchestrator: AutomationOrchestrator,
        @Inject('ChunkRegistry')
        private readonly chunkRegistry: ChunkRegistry,
        private readonly getDocumentsByAutomationIdUseCase: GetDocumentsByAutomationIdUseCase,
        private readonly downloadDocumentUseCase: DownloadDocumentUseCase,
        private readonly downloadOnePagerUseCase: DownloadOnePagerUseCase,
        private readonly downloadReportUseCase: DownloadReportUseCase,
        private readonly createAutomationUseCase: CreateAutomationUseCase,
        private readonly uploadDocumentUseCase: UploadDocumentUseCase,
        private readonly confirmUploadUseCase: ConfirmUploadUseCase,
        private readonly getCompanyByIdUseCase: GetCompanyByIdUseCase,
        @Inject('AutomationRepository')
        private readonly automationRepository: AutomationRepository,
        @Inject('DocumentRepository')
        private readonly documentRepository: DocumentRepository,
        @Inject('AgentGateway')
        private readonly agentGateway: AgentGateway,
    ) { }

    private async assertAutomationExists(automationId: string): Promise<void> {
        const automation = await this.automationRepository.findById(automationId);
        if (!automation) throw new NotFoundException(`Automation ${automationId} not found`);
    }

    @Post('start/:companyId')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }), AutomationIdInterceptor)
    @ApiStartAutomation()
    async startAutomation(
        @Param('companyId', new ParseUUIDPipe()) companyId: string,
        @UploadedFile() file: MulterFile,
        @Body() chunkData: unknown,
        @Req() req: AutomationRequest,
    ) {
        const logger = new Logger('StartAutomation');

        const validatedChunkData = this.chunkValidator.validate(chunkData);

        const isLastChunk = this.chunkValidator.isLastChunk(validatedChunkData);

        // O automation ID é gerado pelo middleware se for o último chunk
        const automationId = req?.automationId || '';

        logger.log(`CONTROLLER AutomationId recebido do middleware: ${automationId}`, {
            isLastChunk,
            chunkNumber: validatedChunkData.chunkNumber,
            totalChunks: validatedChunkData.totalChunks
        });

        // Se é o último chunk, criar automação ANTES de processar

        // TODO: Create useCase to create automation for last chunk
        if (isLastChunk) {
            const automation = await this.automationOrchestrator.createAutomationForLastChunk({
                companyId,
                chunkIdentifier: validatedChunkData.identifier,
                metadata: {
                    totalChunks: Number(validatedChunkData.totalChunks),
                    filename: validatedChunkData.filename
                },
                automationId
            });

            await this.chunkRegistry.updateAutomationId(validatedChunkData.identifier, automation.id);

            logger.log(`Automation created for last chunk`, {
                automationId: automation.id,
                uploadId: validatedChunkData.identifier
            });
        }

        // Emite evento para processamento assíncrono (qualquer ordem)

        // TODO: Create useCase to register chunk

        await this.eventBus.emit('chunk.registered', {
            uploadId: validatedChunkData.identifier,
            chunkNumber: Number(validatedChunkData.chunkNumber),
            totalChunks: Number(validatedChunkData.totalChunks),
            file: {
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                buffer: file.buffer.toString('base64'),
                encoding: file.encoding,
                fieldname: file.fieldname
            },
            metadata: {
                filename: validatedChunkData.filename,
                totalSize: Number(validatedChunkData.totalSize) || file.size * Number(validatedChunkData.totalChunks)
            },
            companyId,
            automationId: automationId || '', // Será buscado do registry quando necessário
            timestamp: new Date(),
            registeredAt: new Date()
        });

        if (isLastChunk) {
            return {
                status: 'automation_created',
                chunk: validatedChunkData.chunkNumber,
                uploadId: validatedChunkData.identifier,
                totalChunks: validatedChunkData.totalChunks,
                message: 'Last chunk queued for processing and automation created'
            };
        }

        logger.debug(`Chunk registered for processing ${validatedChunkData.chunkNumber}/${validatedChunkData.totalChunks}`, {
            chunkNumber: validatedChunkData.chunkNumber,
            uploadId: validatedChunkData.identifier
        });

        return {
            status: 'chunk_stored',
            chunk: validatedChunkData.chunkNumber,
            uploadId: validatedChunkData.identifier,
            totalChunks: validatedChunkData.totalChunks,
            message: 'Chunk uploaded and verified successfully'
        };
    }



    @Post('create/:companyId')
    async createAutomation(
        @Param('companyId', new ParseUUIDPipe()) companyId: string,
    ) {
        return this.createAutomationUseCase.execute({ companyId });
    }

    @Post(':automationId/upload-document')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
    async uploadDocument(
        @Param('automationId', new ParseUUIDPipe()) automationId: string,
        @Body('companyId') companyId: string,
        @UploadedFile() file: MulterFile,
    ) {
        // The automation row is only persisted at the confirm step, so it does
        // not exist yet during create/upload — do not assert its existence here.
        return this.uploadDocumentUseCase.execute({
            automationId,
            companyId,
            file: {
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                buffer: file.buffer,
            },
        });
    }

    @Post(':automationId/confirm')
    async confirmUpload(
        @Param('automationId', new ParseUUIDPipe()) automationId: string,
        @Body() body: { companyId: string; files: { fileName: string; gcsPath: string }[] },
    ) {
        // confirm is the step that actually persists the automation row, so it
        // must not require the automation to already exist.
        return this.confirmUploadUseCase.execute({
            automationId,
            companyId: body.companyId,
            files: body.files,
        });
    }

    @Get(":automationId/documents")
    @ApiGetDocumentsByAutomationId()
    async getDocumentsByAutomationId(
        @Param("automationId", new ParseUUIDPipe()) automationId: string,
    ) {
        await this.assertAutomationExists(automationId);

        const result = await this.getDocumentsByAutomationIdUseCase.execute({
            automationId,
        })

        return {
            documents: result.documents,
        }
    }

    @Get("documents/:documentId/download")
    @ApiDownloadDocument()
    async downloadDocument(
        @Param("documentId", new ParseUUIDPipe()) documentId: string,
    ): Promise<StreamableFile> {
        const document = await this.documentRepository.findById(documentId);
        if (!document) throw new NotFoundException(`Document ${documentId} not found`);
        await this.assertAutomationExists(document.automationId);

        const result = await this.downloadDocumentUseCase.execute({
            documentId,
        })

        return new StreamableFile(result.fileBuffer)
    }

    @Get(":automationId/download-one-pager")
    @ApiDownloadOnePager()
    async downloadOnePager(
        @Param("automationId", new ParseUUIDPipe()) automationId: string,
    ): Promise<StreamableFile> {
        await this.assertAutomationExists(automationId);

        const result = await this.downloadOnePagerUseCase.execute({
            automationId,
        })
        return new StreamableFile(result.fileBuffer)
    }

    @Get(":automationId/download-report")
    @ApiDownloadReport()
    async downloadReport(
        @Param("automationId", new ParseUUIDPipe()) automationId: string,
        @Res() res: Response
    ) {
        await this.assertAutomationExists(automationId);

        const { fileName, fileBuffer, mimeType } = await this.downloadReportUseCase.execute({
            automationId,
        })

        res.set({
            'Content-Type': mimeType,
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': fileBuffer.length,
        });

        res.send(fileBuffer);
    }

    @Post(':automationId/retry')
    async retryAutomation(@Param('automationId', new ParseUUIDPipe()) automationId: string) {
        this.logger.log(`Retry requested for automation ${automationId}`);

        const automation = await this.automationRepository.findById(automationId);
        if (!automation) {
            throw new NotFoundException(`Automation ${automationId} not found`);
        }

        if (automation.status !== AutomationStatus.FAILED) {
            throw new BadRequestException(`Automation ${automationId} is not in FAILED status`);
        }

        if (automation.stage !== AutomationStageDomain.TRIAGE) {
            throw new BadRequestException(`Only TRIAGE automations can be retried`);
        }

        const { company } = await this.getCompanyByIdUseCase.execute({ companyId: automation.companyId });

        const documents = await this.documentRepository.findByAutomationId(automationId);
        const agentDocuments = documents.map(doc => ({
            id: doc.id,
            url: `gs://${process.env.GCLOUD_STORAGE_BUCKET}/${doc.bucketPath}`,
        }));

        await this.automationRepository.updateStatus(automationId, AutomationStatus.PROCESSING);

        try {
            await this.agentGateway.startAgentAutomation({
                company_name: company.name,
                company_id: automation.companyId,
                automation_id: automationId,
                documents: agentDocuments,
                retry: true,
            });
        } catch (err) {
            // Revert to FAILED so the automation doesn't get stuck on PROCESSING
            // when the agent rejects the call (mirrors the confirm/notify flow).
            await this.automationRepository.updateStatus(automationId, AutomationStatus.FAILED);
            this.logger.error(`Automation ${automationId} retry failed to start with the agent`, (err as Error)?.stack || err);
            throw err;
        }

        this.logger.log(`Automation ${automationId} retry started`);
        return { automationId, status: 'PROCESSING' };
    }
}
