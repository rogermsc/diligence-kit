import { Injectable, Inject, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EventBusPort } from '@/shared/domain/interfaces/event-bus.interface';
import { IAutomationRepository } from '@/shared/repository/automation-repository.interface';
import { CompanyRepository } from '@/shared/repository/company-repository.interface';
import { AutomationStatus, AutomationStageDomain } from '@/shared/domain/entities/automation.entity';
import { AutomationCompanyNotFoundError, AutomationAlreadyInProgressError } from '../domain/errors/automation-errors';
import { AutomationCreationError } from '../domain/errors/automation-event-errors';

export interface CreateAutomationData {
    companyId: string;
    chunkIdentifier: string;
    metadata: {
        totalChunks: number;
        filename: string;
    };
    automationId?: string;
}

@Injectable()
export class AutomationOrchestrator {
    private readonly logger = new Logger(AutomationOrchestrator.name);

    constructor(
        @Inject('EventBusPort')
        private readonly eventBus: EventBusPort,
        @Inject('AutomationRepository')
        private readonly automationRepository: IAutomationRepository,
        @Inject('CompanyRepository')
        private readonly companyRepository: CompanyRepository,
    ) { }

    async createAutomationForLastChunk(data: CreateAutomationData) {
        this.logger.debug('Creating automation for last chunk', {
            companyId: data.companyId,
            chunkIdentifier: data.chunkIdentifier
        });

        const companyResult = await this.companyRepository.findById(data.companyId);

        if (!companyResult) {
            throw new AutomationCompanyNotFoundError(data.companyId);
        }

        const existingAutomation = await this.automationRepository.findProcessingByCompanyId(data.companyId);

        if (existingAutomation) {
            throw new AutomationAlreadyInProgressError();
        }

        try {
            // Garante que sempre temos um automationId válido
            const automationId = data.automationId || randomUUID();

            const automation = await this.automationRepository.create({
                id: automationId,
                companyId: data.companyId,
                status: AutomationStatus.PENDING,
            });

            this.logger.log('Automation created successfully', {
                automationId: automation.id,
                companyId: automation.companyId,
                status: automation.status,
                providedId: data.automationId,
                usedId: automationId
            });

            return automation;
        } catch (error) {
            this.logger.error('Failed to create automation', {
                companyId: data.companyId,
                error: error.message
            });
            throw new AutomationCreationError();
        }
    }
} 