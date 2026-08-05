import { Injectable, Logger, Inject } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { ChunkReceivedEvent, AutomationCreatedEvent, ZipAssembledEvent, DocumentsUploadedEvent, AgentNotificationEvent, AutomationUpdatedEvent } from '../domain/events/automation.events';
import { ZipAssembledEventSchema, DocumentsUploadedEventSchema, AgentNotificationEventSchema, AutomationUpdatedEventSchema } from '../domain/events/automation.event-schemas';

import { UploadHelper } from '../helpers/upload.helper';
import { AutomationZipUploadUseCase } from '../use-case/automation-zip-upload.usecase';
import { SaveDocumentsUseCase } from '../use-case/save-documents.usecase';
import { NotifyAgentWithDocumentsUseCase } from '../use-case/notify-agent-with-documents.usecase';
import { UpdateAutomationStatusUseCase } from '../use-case/update-automation-status.usecase';
import { AutomationStatus } from '@/shared/domain/entities/automation.entity';
import { StorageService } from '@/shared/services/storage.service';
import { EventBusPort } from '@/shared/domain/interfaces/event-bus.interface';
import {
    ChunkProcessingError,
    ZipAssemblyError,
    DocumentUploadError,
    DocumentSaveError,
    AgentNotificationError
} from '../domain/errors/automation-event-errors';
import { IAutomationRepository } from '@/shared/repository/automation-repository.interface';

@Injectable()
@Processor('automation-queue')
export class AutomationJobProcessor {
    private readonly logger = new Logger(AutomationJobProcessor.name);

    constructor(
        private readonly zipUploadUseCase: AutomationZipUploadUseCase,
        private readonly saveDocumentsUseCase: SaveDocumentsUseCase,
        private readonly notifyAgentUseCase: NotifyAgentWithDocumentsUseCase,
        private readonly updateStatusUseCase: UpdateAutomationStatusUseCase,
        @Inject('StorageService')
        private readonly storageService: StorageService,
        @Inject('EventBusPort')
        private readonly eventBus: EventBusPort,
        @Inject('AutomationRepository')
        private readonly automationRepository: IAutomationRepository,
    ) { }


    @Process('zip.assembled')
    async handleZipAssembled(job: Job<ZipAssembledEvent>): Promise<void> {
        const { automationId, companyId, companyName, zipFile: zipFileMetadata } = ZipAssembledEventSchema.parse(job.data);

        this.logger.debug('Processing ZIP assembled (files already uploaded)', {
            automationId,
            companyName,
            zipFileName: zipFileMetadata.originalname,
            totalFilesUploaded: zipFileMetadata.totalFiles
        });

        try {
            // Os arquivos já foram processados e estão no bucket
            // Agora apenas precisamos preparar os dados para salvar no banco
            const uploadResult = {
                documents: [], // Será populado pelo saveDocumentsUseCase baseado nos uploadedFiles
                uploadedFiles: zipFileMetadata.uploadedFiles || []
            };

            this.logger.debug('Files already processed in bucket', {
                automationId,
                uploadedFilesCount: uploadResult.uploadedFiles.length
            });

            // Emite evento para salvamento dos documentos
            await this.eventBus.emit('documents.uploaded', {
                automationId,
                companyId,
                companyName,
                uploadResult,
                timestamp: new Date()
            });
        } catch (error) {
            this.logger.error('Failed to process ZIP assembled and update status for FAILED', {
                automationId,
                error: error.message
            });

            await this.updateStatusUseCase.execute({
                automationId,
                status: AutomationStatus.FAILED
            });

            throw new DocumentUploadError();
        }
    }

    @Process('documents.uploaded')
    async handleDocumentsUploaded(job: Job<DocumentsUploadedEvent>): Promise<void> {
        const { automationId, companyId, companyName, uploadResult } = DocumentsUploadedEventSchema.parse(job.data);

        this.logger.debug('Processing documents uploaded', {
            automationId,
            uploadedFilesCount: uploadResult.uploadedFiles?.length || 0
        });

        try {
            // Salva documentos no banco
            const savedDocuments = await this.saveDocumentsUseCase.execute({
                automationId,
                uploadedFiles: uploadResult.uploadedFiles,
            });

            this.logger.debug('Documents saved to database', {
                automationId,
                savedDocumentsCount: savedDocuments.documents?.length || 0
            });

            // Emite evento para notificação do agente
            await this.eventBus.emit('agent.notification.ready', {
                automationId,
                companyId,
                companyName,
                documents: savedDocuments.documents,
                timestamp: new Date()
            });
        } catch (error) {
            this.logger.error('Failed to process documents uploaded', {
                automationId,
                error: error.message
            });
            throw new DocumentSaveError();
        }
    }

    @Process('agent.notification.ready')
    async handleAgentNotification(job: Job<AgentNotificationEvent>): Promise<void> {
        const { automationId, companyId, companyName, documents } = AgentNotificationEventSchema.parse(job.data);

        this.logger.debug('Processing agent notification ready', {
            automationId,
            companyName,
            documentsCount: documents?.length || 0
        });

        try {
            // Busca a automação atualizada

            const automation = await this.automationRepository.findById(automationId);
            if (!automation) {
                throw new Error(`Automation ${automationId} not found`);
            }

            // Atualiza status para PROCESSING
            await this.updateStatusUseCase.execute({
                automationId,
                status: AutomationStatus.PROCESSING
            });

            // Notifica o agente
            await this.notifyAgentUseCase.execute({
                automation,
                companyName,
                documents: documents.map(doc => ({
                    id: doc.id,
                    url: doc.bucketPath,
                })),
            });

            this.logger.debug('Agent notified successfully', {
                automationId,
                companyName
            });
        } catch (error) {
            this.logger.error('Failed to process agent notification', {
                automationId,
                error: error.message
            });

            // Em caso de erro, atualiza status para FAILED
            await this.updateStatusUseCase.execute({
                automationId,
                status: AutomationStatus.FAILED
            });

            throw new AgentNotificationError();
        }
    }

    @Process('automation.updated')
    async handleAutomationUpdated(job: Job<AutomationUpdatedEvent>): Promise<void> {
        const { automationId, status } = AutomationUpdatedEventSchema.parse(job.data);

        this.logger.log('Automation status updated', {
            automationId,
            status
        });

        // Este handler serve principalmente para logging e possíveis side effects
        // A atualização real do status já foi feita pelo AutomationStatusUpdaterService
    }
} 