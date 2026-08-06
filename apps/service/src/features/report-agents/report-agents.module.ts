import { Module } from "@nestjs/common"
import { BullModule } from "@nestjs/bull"

import { TriggerSecondStageController } from "./presentation/trigger-second-stage.controller"
import { TriggerSecondStageUseCase } from "./use-cases/trigger-second-stage.usecase"

import { PrismaAutomationRepositoryAdapter } from "@/shared/infra/adapters/prisma-automation-repository.adapter"
import { PrismaCompanyRepositoryAdapter } from "@/shared/infra/adapters/prisma-company-repository.adapter"
import { PrismaDocumentRepositoryAdapter } from "@/shared/infra/adapters/prisma-document-repository.adapter"
import { PrismaResultRepositoryAdapter } from "@/shared/infra/adapters/prisma-result-repository.adapter"
import { MultiQueueEventBusAdapter } from "@/shared/infra/adapters/multi-queue-event-bus.adapter"
import { AuthModule } from "@/features/auth/auth.module"
import { AgentModule } from "@/features/onePager-agent/agent/agent.module"
import { ReportAgentsExceptionFilter } from "./infra/filters/report-agents-exception.filter"
import { OwnershipService } from "@/shared/services/ownership.service"

@Module({
    imports: [
        AuthModule,
        AgentModule,
        BullModule.registerQueue({ name: "automation-queue" }),
        BullModule.registerQueue({ name: "chunk-processing-queue" }),
        BullModule.registerQueue({ name: "chunk-retry-queue" }),
        BullModule.registerQueue({ name: "assembly-queue" }),
    ],
    controllers: [TriggerSecondStageController],
    providers: [
        OwnershipService,
        // Exception filters
        ReportAgentsExceptionFilter,

        // Event bus
        { provide: "EventBusPort", useClass: MultiQueueEventBusAdapter },

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
