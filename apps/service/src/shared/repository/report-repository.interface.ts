import { AgentType } from "@/features/onePager-agent/agent/domain/agent-type"
import { Report } from "@/shared/domain/entities/report.entity"

export interface CreateReportData {
    automationId: string
    companyId: string
    domain: AgentType
    reportUrl: string
}

export interface ReportRepository {
    findByAutomationId(automationId: string): Promise<Report[]>
    countByAutomationId(automationId: string): Promise<number>
    hasAllAgentReports(automationId: string): Promise<boolean>
}
