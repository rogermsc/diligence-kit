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
import { APP_INTERCEPTOR } from "@nestjs/core"
import { TenancyInterceptor } from "@/shared/tenancy/tenancy.interceptor"
import { OwnershipService } from "@/shared/services/ownership.service"
import { StaleAutomationReaper } from "@/shared/services/stale-automation-reaper.service"

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
    providers: [
        ErrorDispatcherService,
        OwnershipService,
        // Nothing else ever revisits an automation whose agent callback
        // never arrived, so without this they stay PROCESSING forever.
        StaleAutomationReaper,
        // Global and deny-by-default: an authenticated route that declares no
        // tenancy rule is refused rather than quietly serving another tenant.
        // An interceptor, not a guard — global guards run before the
        // controller-scoped AuthGuard that sets request.user, so as a guard it
        // saw no user and allowed everything. See tenancy.interceptor.ts.
        { provide: APP_INTERCEPTOR, useClass: TenancyInterceptor },
    ],
})
export class AppModule {}
