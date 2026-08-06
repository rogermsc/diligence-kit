import axios from "axios"
import {
    AgentGateway,
    StartAgentAutomationInput,
    StartAgentAutomationOutput,
} from "./agent-gateway.interface"

export class AgentGatewayAxiosAdapter implements AgentGateway {
    async startAgentAutomation(
        input: StartAgentAutomationInput,
    ): Promise<StartAgentAutomationOutput> {
        const response = await axios.post(
            process.env.AGENT_API_URL + "/api/v1/analyze",
            input,
            {
                headers: {
                    "X-API-Key": process.env.AGENT_API_KEY,
                },
                timeout: 30_000,
            },
        )
        return {
            status: response.data.status,
            agentResponse: response.data,
        }
    }
}
