export interface AgentDocument {
    id: string
    url: string
    openai_file_id?: string
}

export interface StartAgentAutomationInput {
    company_name: string
    company_id: string
    automation_id: string
    documents: AgentDocument[]
    retry?: boolean
}

export interface StartAgentAutomationOutput {
    status: string
    agentResponse: any
}

export interface AgentGateway {
    startAgentAutomation(
        input: StartAgentAutomationInput,
    ): Promise<StartAgentAutomationOutput>
}
