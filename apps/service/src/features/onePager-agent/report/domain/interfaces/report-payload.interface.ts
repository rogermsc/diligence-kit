import { AgentType } from "@/features/onePager-agent/agent/domain/agent-type"
import { ReportStatus } from "@/shared/domain/entities"

export interface ReportPayload {
    automationId: string
    reportUrl?: string
    domain: AgentType
    status: ReportStatus
}
