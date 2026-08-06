import { AgentType } from "@/features/onePager-agent/agent/domain/agent-type"
import { Report } from "@/shared/domain/entities/report.entity"

export interface CreateReportData {
    automationId: string
    companyId: string
    domain: AgentType
    reportUrl: string
}

export interface ReportRepository {
    createOrUpdate(data: CreateReportData): Promise<Report>
    findByAutomationId(automationId: string): Promise<Report[]>
    findByAutomationIdAndDomain(
        automationId: string,
        domain: AgentType,
    ): Promise<Report | null>
    countByAutomationId(automationId: string): Promise<number>
    hasAllAgentReports(automationId: string): Promise<boolean>
    deleteExpiredReports(daysOld: number): Promise<number>
}
