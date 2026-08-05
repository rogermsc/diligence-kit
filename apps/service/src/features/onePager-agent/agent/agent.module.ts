import { AgentService } from '@/features/onePager-agent/agent/agent.service';
import { Module } from '@nestjs/common';

@Module({
    providers: [AgentService],
    exports: [AgentService],
})
export class AgentModule { }
