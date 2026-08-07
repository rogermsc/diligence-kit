import { Module } from "@nestjs/common"

import { TriggerSecondStageController } from "./presentation/trigger-second-stage.controller"
import { TriggerSecondStageUseCase } from "./use-cases/trigger-second-stage.usecase"

import { PrismaAutomationRepositoryAdapter } from "@/shared/infra/adapters/prisma-automation-repository.adapter"
import { PrismaCompanyRepositoryAdapter } from "@/shared/infra/adapters/prisma-company-repository.adapter"
import { PrismaDocumentRepositoryAdapter } from "@/shared/infra/adapters/prisma-document-repository.adapter"
import { PrismaResultRepositoryAdapter } from "@/shared/infra/adapters/prisma-result-repository.adapter"
import { AuthModule } from "@/features/auth/auth.module"
import { AgentModule } from "@/features/onePager-agent/agent/agent.module"
import { ReportAgentsExceptionFilter } from "./infra/filters/report-agents-exception.filter"

@Module({
    imports: [AuthModule, AgentModule],
    controllers: [TriggerSecondStageController],
    providers: [
        // Exception filters
        ReportAgentsExceptionFilter,

        // Use cases
        TriggerSecondStageUseCase,

        // Repositories (extended contracts rely on same adapters)
        {
            provide: "AutomationRepository",
            useClass: PrismaAutomationRepositoryAdapter,
        },
        {
            provide: "CompanyRepository",
            useClass: PrismaCompanyRepositoryAdapter,
        },
        {
            provide: "IResultRepository",
            useClass: PrismaResultRepositoryAdapter,
        },
        {
            provide: "DocumentRepository",
            useClass: PrismaDocumentRepositoryAdapter,
        },
    ],
    exports: [],
})
export class ReportAgentsModule {}
