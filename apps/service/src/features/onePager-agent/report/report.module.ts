import { Module } from "@nestjs/common"
import { CompleteReportController } from "./presentation/complete-report.controller"
import { ProcessCompletedReportUseCase } from "./use-cases/process-completed-report.usecase"
import { ProcessFailedReportUseCase } from "./use-cases/process-failed-report.usecase"
import { VerifyAllReportsAreReceivedUseCase } from "./use-cases/verify-all-reports-are-received.usecase"
import { ReportCompletedUseCase } from "./use-cases/report-completed.usecase"
import { PrismaReportRepositoryAdapter } from "@/shared/infra/adapters/prisma-report-repository.adapter"
import { PrismaAutomationRepositoryAdapter } from "@/shared/infra/adapters/prisma-automation-repository.adapter"
import { AgentModule } from "@/features/onePager-agent/agent/agent.module"
import { DelegateSpecificProcessReportUseCase } from "@/features/onePager-agent/report/use-cases/delegate-process-report.usecase"
import { ReportProcessorFactory } from "./factories/report-processor.factory"

@Module({
    imports: [AgentModule],
    controllers: [CompleteReportController],
    providers: [
        // Factories
        ReportProcessorFactory,

        // Use cases
        DelegateSpecificProcessReportUseCase,
        ProcessCompletedReportUseCase,
        ProcessFailedReportUseCase,
        VerifyAllReportsAreReceivedUseCase,
        ReportCompletedUseCase,

        // Infrastructure
        {
            provide: "ReportRepository",
            useClass: PrismaReportRepositoryAdapter,
        },
        {
            provide: "AutomationRepository",
            useClass: PrismaAutomationRepositoryAdapter,
        },
    ],
    exports: [
        ReportProcessorFactory,
        DelegateSpecificProcessReportUseCase,
        ProcessCompletedReportUseCase,
        ProcessFailedReportUseCase,
        VerifyAllReportsAreReceivedUseCase,
        ReportCompletedUseCase,
    ],
})
export class ReportModule {}
