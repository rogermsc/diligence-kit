import { Module } from "@nestjs/common"
import { BullModule } from "@nestjs/bull"
import { CompanyModule } from "@/features/company/company.module"
import { ErrorDispatcherService } from "@/shared/errors/error-dispatcher.service"
import { AutomationModule } from "@/features/automation/automation.module"
import { AuthModule } from "@/features/auth/auth.module"
import { ReportAgentsModule } from "@/features/report-agents/report-agents.module"
import { LiaisonModule } from "@/features/liaison/liaison.module"

import { config } from "dotenv"
import { AgentModule } from "@/features/onePager-agent/agent/agent.module"
import { ReportModule } from "@/features/onePager-agent/report"
import { HealthController } from "@/shared/infra/health/health.controller"

config()

@Module({
    imports: [
        BullModule.forRoot({
            redis: {
                host: process.env.REDIS_HOST || "localhost",
                port: parseInt(process.env.REDIS_PORT || "6381"),
            },
            // defaultJobOptions: {
            //     removeOnComplete: true,
            //     attempts: 3,
            // },
        }),
        CompanyModule,
        AutomationModule,
        AuthModule,
        AgentModule,
        ReportModule,
        ReportAgentsModule,
        LiaisonModule,
    ],
    controllers: [HealthController],
    providers: [ErrorDispatcherService],
})
export class AppModule {}
