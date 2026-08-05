import { Automation as DomainAutomation, AutomationStatus, AutomationStageDomain } from '@/shared/domain/entities/automation.entity';
import { AgentType } from '@/features/onePager-agent/agent/domain/agent-type';
import { Report } from '@/shared/domain/entities/report.entity';

export interface CreateAutomationData {
    id?: string
    companyId: string
    status?: AutomationStatus
    parentAutomationId?: string
}

export interface CreateDiligenceAutomationData {
    id?: string
    companyId: string
    status?: AutomationStatus
    stage: AutomationStageDomain
    parentAutomationId: string
}

export interface CreateOnePagerData {
    automationId: string
    companyId: string
    url: string
}

export interface UpdateAutomationWithReportData {
    automationId: string
    automationStatus: AutomationStatus
    reportData?: {
        companyId: string
        domain: AgentType
        reportUrl: string
    }
}

export interface IAutomationRepository {
    create(data: CreateAutomationData): Promise<DomainAutomation>
    createMany(data: CreateDiligenceAutomationData[]): Promise<DomainAutomation[]>
    findById(id: string): Promise<DomainAutomation | null>
    findTriageCompletedById(id: string): Promise<DomainAutomation | null>
    findProcessingByCompanyId(companyId: string): Promise<DomainAutomation | null>
    findByParentAutomationId(parentAutomationId: string): Promise<DomainAutomation[]>
    updateStatus(id: string, status: AutomationStatus): Promise<void>
    updateAutomationWithReport(data: UpdateAutomationWithReportData): Promise<Report | null>
    createOrUpdateOnePager(data: CreateOnePagerData): Promise<void>
    findOnePagerByAutomationId(automationId: string): Promise<{ id: string; url: string } | null>
    findLatestOnePagerByCompanyId(companyId: string): Promise<{ id: string; url: string } | null>
} 