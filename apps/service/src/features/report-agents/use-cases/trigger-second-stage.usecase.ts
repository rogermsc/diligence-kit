import { Injectable, Logger, Inject } from '@nestjs/common'
import { Usecase } from '@/shared/interfaces/usecase'
import { AgentType } from '@prisma/client'
import { AutomationStatus } from '@/shared/domain/entities/automation.entity'
import { EventBusPort } from '@/shared/domain/interfaces/event-bus.interface'
import { AgentService } from '@/features/onePager-agent/agent/agent.service'
import { StartReportsPayload } from '@/features/onePager-agent/agent/data/dto/agent-event-payload'

import { IAutomationRepository, CreateDiligenceAutomationData } from '@/shared/repository/automation-repository.interface'
import { DocumentRepository } from '@/shared/repository/document-repository.interface'
import { CompanyRepository } from '@/shared/repository/company-repository.interface'

import { SectorDomainMapperHelper } from '@/shared/domain/mappers/sector-domain-mapper.helper'
import { InvalidAutomationStageError, DiligenceCreationFailedError, AutomationNotFoundError, DiligenceAutomationsAlreadyExistError } from '../domain/errors/report-agent.errors'

export interface TriggerSecondStageInput {
  automationId: string
}

export interface TriggerSecondStageOutput {
  operationalId: string
  commercialId: string
  financialId: string
  capTableAndLegalReviewId: string
}


@Injectable()
export class TriggerSecondStageUseCase implements Usecase<TriggerSecondStageInput, TriggerSecondStageOutput> {
  private readonly logger = new Logger(TriggerSecondStageUseCase.name)

  constructor(
    @Inject('AutomationRepository')
    private readonly automationRepository: IAutomationRepository,
    @Inject('EventBusPort')
    private readonly eventBus: EventBusPort,
    @Inject('DocumentRepository')
    private readonly documentRepository: DocumentRepository,
    @Inject('CompanyRepository')
    private readonly companyRepository: CompanyRepository,
    private readonly agentService: AgentService,
  ) { }

  async execute(input: TriggerSecondStageInput): Promise<TriggerSecondStageOutput> {
    // Validations outside try-catch (these should bubble up as-is)
    const automation = await this.automationRepository.findById(input.automationId)

    if (!automation) {
      throw new AutomationNotFoundError()
    }

    const completedTriageAutomation = await this.automationRepository.findTriageCompletedById(input.automationId)

    if (!completedTriageAutomation) {
      throw new InvalidAutomationStageError()
    }

    const existingDiligenceAutomations = await this.automationRepository.findByParentAutomationId(completedTriageAutomation.id)

    const isDiligenceAutomationsAlreadyExist = existingDiligenceAutomations.length > 0

    if (isDiligenceAutomationsAlreadyExist) {
      throw new DiligenceAutomationsAlreadyExistError()
    }

    try {
      // Fetch documents from parent (triage) automation
      const documents = await this.documentRepository.findByAutomationId(completedTriageAutomation.id)
      const agentDocuments = documents.map(doc => ({
        id: doc.id,
        url: doc.bucketPath,
        openai_file_id: doc.openaiFileId,
      }))

      // Fetch company name
      const company = await this.companyRepository.findById(completedTriageAutomation.companyId)
      const companyName = company?.name || ''

      const automationsToCreate = this.buildAutomationsData({
        parentAutomationId: completedTriageAutomation.id,
        companyId: completedTriageAutomation.companyId
      })

      this.logger.log('Creating diligence automations', {
        parentAutomationId: completedTriageAutomation.id,
        companyId: completedTriageAutomation.companyId,
        automationsToCreate: automationsToCreate.length,
        documentsCount: agentDocuments.length,
      });

      const createdAutomations = await this.automationRepository.createMany(automationsToCreate)
      const createdAutomationIds = this.mapCreatedAutomationIds(createdAutomations)

      // Build payload with documents and company name
      const automations: StartReportsPayload[] = SectorDomainMapperHelper
        .getAllDiligenceDomains()
        .map(domain => ({
          automation_id: createdAutomationIds[domain],
          domain,
          company_id: completedTriageAutomation.companyId,
          company_name: companyName,
          documents: agentDocuments,
        }))

      this.logger.log('About to call agentService.startReports', {
        automationsCount: automations.length,
        automations: automations.map(a => ({
          automation_id: a.automation_id,
          domain: a.domain,
          documentsCount: a.documents.length,
        })),
      });

      try {
        await this.agentService.startReports(automations)
      } catch (agentError) {
        // The diligence automations were already persisted as PROCESSING. If the
        // agent call fails, mark them FAILED so they don't get stuck in PROCESSING.
        await Promise.all(
          Object.values(createdAutomationIds)
            .filter(Boolean)
            .map(id => this.automationRepository.updateStatus(id, AutomationStatus.FAILED)),
        )
        throw agentError
      }

      this.logger.log('agentService.startReports completed successfully');

      return {
        operationalId: createdAutomationIds[AgentType.OPERATIONAL],
        commercialId: createdAutomationIds[AgentType.COMMERCIAL],
        financialId: createdAutomationIds[AgentType.FINANCIAL],
        capTableAndLegalReviewId: createdAutomationIds[AgentType.CAP_TABLE_AND_LEGAL_REVIEW],
      }
    } catch (error) {
      if (error instanceof AutomationNotFoundError ||
        error instanceof InvalidAutomationStageError ||
        error instanceof DiligenceAutomationsAlreadyExistError) {
        throw error;
      }
      this.logger.error('Failed to create diligence automations', error.stack)
      throw new DiligenceCreationFailedError()
    }
  }


  private buildAutomationsData(input: { parentAutomationId: string; companyId: string }): CreateDiligenceAutomationData[] {
    return SectorDomainMapperHelper
      .getAllDiligenceDomains()
      .map(domain => ({
        companyId: input.companyId,
        status: AutomationStatus.PROCESSING,
        stage: SectorDomainMapperHelper.mapDomainToStage(domain),
        parentAutomationId: input.parentAutomationId
      }))
  }


  private mapCreatedAutomationIds(createdAutomations: any[]): Record<AgentType, string> {
    const domains = SectorDomainMapperHelper.getAllDiligenceDomains()
    const createdAutomationIds: Record<AgentType, string> = {
      [AgentType.OPERATIONAL]: '',
      [AgentType.COMMERCIAL]: '',
      [AgentType.FINANCIAL]: '',
      [AgentType.CAP_TABLE_AND_LEGAL_REVIEW]: '',
    }

    domains.forEach((domain, index) => {
      createdAutomationIds[domain] = createdAutomations[index]?.id || ''
    })

    return createdAutomationIds
  }
}
