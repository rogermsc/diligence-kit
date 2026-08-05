import { StartReportsPayload } from '@/features/onePager-agent/agent/data/dto/agent-event-payload';
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

const AGENT_API_URL = process.env.AGENT_API_URL!;
const AGENT_API_KEY = process.env.AGENT_API_KEY!;

@Injectable()
export class AgentService {
    private readonly logger = new Logger(AgentService.name);

    private buildAuthHeader(): Record<string, string> {
        // The agent's /api/v1/diligence endpoint authenticates with the static
        // X-API-Key header (same as /api/v1/analyze), not a Bearer JWT.
        return { 'X-API-Key': AGENT_API_KEY };
    }

    async startReports(automations: StartReportsPayload[]) {
        const url = `${AGENT_API_URL}/api/v1/diligence`;

        this.logger.log('Starting diligence via HTTP POST', {
            url,
            automationsCount: automations.length,
        });

        try {
            const response = await axios.post(
                url,
                { automations },
                { headers: this.buildAuthHeader(), timeout: 30_000 },
            );

            this.logger.log('Diligence request sent successfully', {
                status: response.status,
                automations: automations.map(a => ({
                    automation_id: a.automation_id,
                    domain: a.domain,
                    company_id: a.company_id,
                })),
            });
        } catch (error) {
            this.logger.error('Failed to start diligence', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }
}
