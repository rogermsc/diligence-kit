import { AgentDocument } from "@/features/automation/start-automation/gateway/agent-gateway.interface"

/**
 * What the backend sends the agent to start one domain report.
 *
 * `AgentDocument` is imported rather than redeclared: this file used to carry a
 * byte-identical copy of it, and an `AgentEmitPayload` for an event system that
 * has no emitters and no listeners anywhere in the codebase.
 */
export interface StartReportsPayload {
    automation_id: string
    domain: string
    company_id: string
    company_name: string
    documents: AgentDocument[]
}
