import { Prisma } from "@prisma/client"
import {
    Automation as DomainAutomation,
    AutomationStatus,
    AutomationStageDomain,
} from "@/shared/domain/entities/automation.entity"
import { AgentType } from "@/features/onePager-agent/agent/domain/agent-type"
import { Report } from "@/shared/domain/entities/report.entity"

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
    /**
     * The structured analysis, stored verbatim as the agent produced it.
     * Optional so a callback from an older agent leaves an existing blob
     * intact — Prisma skips `undefined` on update rather than nulling it.
     */
    analysis?: Prisma.InputJsonValue
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
    createMany(
        data: CreateDiligenceAutomationData[],
    ): Promise<DomainAutomation[]>
    findById(id: string): Promise<DomainAutomation | null>
    findTriageCompletedById(id: string): Promise<DomainAutomation | null>
    findProcessingByCompanyId(
        companyId: string,
    ): Promise<DomainAutomation | null>
    findByParentAutomationId(
        parentAutomationId: string,
    ): Promise<DomainAutomation[]>
    updateStatus(id: string, status: AutomationStatus): Promise<void>
    recordHeartbeat(id: string): Promise<boolean>
    updateAutomationWithReport(
        data: UpdateAutomationWithReportData,
    ): Promise<Report | null>
    createOrUpdateOnePager(data: CreateOnePagerData): Promise<void>
    findOnePagerByAutomationId(
        automationId: string,
    ): Promise<{ id: string; url: string; analysis: unknown } | null>
    findLatestOnePagerByCompanyId(
        companyId: string,
    ): Promise<{ id: string; url: string } | null>
}
