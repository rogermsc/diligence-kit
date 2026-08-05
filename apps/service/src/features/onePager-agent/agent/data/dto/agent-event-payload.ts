export interface AgentEmitPayload {
    companyId: string,
    automationId: string,
    documents: Map<String, String[]>
}

export interface AgentDocument {
    id: string
    url: string
    openai_file_id?: string
}

export interface StartReportsPayload {
    automation_id: string
    domain: string
    company_id: string
    company_name: string
    documents: AgentDocument[]
}