import { AgentType } from "@/features/onePager-agent/agent/domain/agent-type"
import { ReportStatus } from "@/shared/domain/entities"

export interface ReportPayload {
    automationId: string
    reportUrl?: string
    domain: AgentType
    status: ReportStatus
    /**
     * The domain run's evidence trail — facts with quotes and pages, coverage,
     * and the conflicts a rule settled. Stored verbatim, never read inside.
     */
    analysis?: unknown
}
