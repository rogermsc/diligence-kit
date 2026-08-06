import { Module } from "@nestjs/common"
import { BullModule } from "@nestjs/bull"
import { AutomationController } from "./presentation/automation.controller"
import { AutomationZipUploadUseCase } from "./use-case/automation-zip-upload.usecase"
import { GoogleStorageService } from "@/shared/services/google-storage.service"
import { LocalStorageService } from "@/shared/services/local-storage.service"
import { YauzlZipParserService } from "@/shared/services/yauzl-zip-parser.service"
import { AgentGatewayAxiosAdapter } from "./gateway/agent-gateway-axios.adapter"
import { GetCompanyByIdUseCase } from "./use-case/get-company-by-id.usecase"
import { SaveDocumentsUseCase } from "./use-case/save-documents.usecase"
import { GetDocumentsByAutomationIdUseCase } from "./use-case/get-documents-by-automation-id.usecase"
import { DownloadDocumentUseCase } from "./use-case/download-document.usecase"
import { NotifyAgentWithDocumentsUseCase } from "./use-case/notify-agent-with-documents.usecase"
import { PrismaAutomationRepositoryAdapter } from "@/shared/infra/adapters/prisma-automation-repository.adapter"
import { PrismaCompanyRepositoryAdapter } from "@/shared/infra/adapters/prisma-company-repository.adapter"
import { PrismaDocumentRepositoryAdapter } from "@/shared/infra/adapters/prisma-document-repository.adapter"
import { PrismaResultRepositoryAdapter } from "@/shared/infra/adapters/prisma-result-repository.adapter"
import { PrismaReportRepositoryAdapter } from "@/shared/infra/adapters/prisma-report-repository.adapter"
import { CheckCompanyHasProcessingAutomationUseCase } from "./use-case/check-company-has-processing-automation.usecase"
import { DownloadOnePagerUseCase } from "./use-case/download-one-pager.usecase"
import { DownloadReportUseCase } from "./use-case/download-report.usecase"
import { AuthModule } from "@/features/auth/auth.module"
import { UpdateAutomationStatusUseCase } from "./use-case/update-automation-status.usecase"
import { CreateAutomationUseCase } from "./use-case/create-automation.usecase"
import { UploadDocumentUseCase } from "./use-case/upload-document.usecase"
import { ConfirmUploadUseCase } from "./use-case/confirm-upload.usecase"

import { InMemoryUploadProgressTracker } from "./infra/repositories/in-memory-chunk-metadata.repository"
import { RedisChunkRegistry } from "./infra/repositories/redis-chunk-registry.repository"
import { MultiQueueEventBusAdapter } from "@/shared/infra/adapters/multi-queue-event-bus.adapter"
import { AutomationOrchestrator } from "./services/automation-orchestrator.service"
import { ChunkValidator } from "./services/chunk-validator.service"
import { AutomationJobProcessor } from "./jobs/automation-job.processor"
import { ChunkProcessingJobProcessor } from "./jobs/chunk-processing-job.processor"
import { ChunkRetryJobProcessor } from "./jobs/chunk-retry-job.processor"
import { AssemblyJobProcessor } from "./jobs/assembly-job.processor"
import { AutomationStatusUpdaterService } from "./services/automation-status-updater.service"
import { BatchChunkProcessorService } from "./services/batch-chunk-processor.service"
import { BatchUploadAdapterService } from "./services/batch-upload-adapter.service"
import { EnhancedChunkProcessorService } from "./services/enhanced-chunk-processor.service"
import { BatchDownloadAdapterService } from "./services/batch-download-adapter.service"
import { EnhancedAssemblyCoordinatorService } from "./services/enhanced-assembly-coordinator.service"
import { ChunkProcessingOptimizerService } from "./services/chunk-processing-optimizer.service"
import { AutomationIdMiddleware } from "./middleware/automation-id.middleware"
import { AutomationIdInterceptor } from "./interceptors/automation-id.interceptor"

@Module({
    imports: [
        AuthModule,
        BullModule.registerQueue({
            name: "automation-queue",
        }),
        BullModule.registerQueue({
            name: "chunk-processing-queue",
            // força processamento estritamente serial (1 por vez)
            // a concorrência do processor também está 1
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: "exponential", delay: 1000 },
                removeOnComplete: 100,
                removeOnFail: 50,
            },
        }),
        BullModule.registerQueue({
            name: "chunk-retry-queue",
        }),
        BullModule.registerQueue({
            name: "assembly-queue",
        }),
    ],
    controllers: [AutomationController],
    providers: [
        // Event-driven architecture components
        {
            provide: "EventBusPort",
            useClass: MultiQueueEventBusAdapter,
        },
        AutomationOrchestrator,
        ChunkValidator,
        AutomationJobProcessor,
        ChunkProcessingJobProcessor,
        ChunkRetryJobProcessor,
        AssemblyJobProcessor,
        AutomationStatusUpdaterService,
        BatchChunkProcessorService,
        BatchUploadAdapterService,
        EnhancedChunkProcessorService,
        BatchDownloadAdapterService,
        EnhancedAssemblyCoordinatorService,
        ChunkProcessingOptimizerService,

        // Existing use cases and services
        AutomationZipUploadUseCase,
        GetCompanyByIdUseCase,
        SaveDocumentsUseCase,
        GetDocumentsByAutomationIdUseCase,
        DownloadDocumentUseCase,
        NotifyAgentWithDocumentsUseCase,
        CheckCompanyHasProcessingAutomationUseCase,
        DownloadOnePagerUseCase,
        DownloadReportUseCase,
        UpdateAutomationStatusUseCase,
        CreateAutomationUseCase,
        UploadDocumentUseCase,
        ConfirmUploadUseCase,
        AutomationIdMiddleware,
        AutomationIdInterceptor,

        // Storage and infrastructure
        {
            provide: "StorageService",
            useClass:
                process.env.STORAGE_DRIVER === "local"
                    ? LocalStorageService
                    : GoogleStorageService,
        },
        {
            provide: "ChunkUploadProgressTracker",
            useClass: InMemoryUploadProgressTracker,
        },
        {
            provide: "ChunkRegistry",
            useClass: RedisChunkRegistry,
        },
        YauzlZipParserService,

        // Repositories
        { provide: "AgentGateway", useClass: AgentGatewayAxiosAdapter },
        {
            provide: "AutomationRepository",
            useClass: PrismaAutomationRepositoryAdapter,
        },
        {
            provide: "CompanyRepository",
            useClass: PrismaCompanyRepositoryAdapter,
        },
        {
            provide: "DocumentRepository",
            useClass: PrismaDocumentRepositoryAdapter,
        },
        {
            provide: "IResultRepository",
            useClass: PrismaResultRepositoryAdapter,
        },
        {
            provide: "ReportRepository",
            useClass: PrismaReportRepositoryAdapter,
        },
        { provide: "ZipParserService", useClass: YauzlZipParserService },
    ],
    exports: [
        // Export StorageService so other modules can use it
        "StorageService",
        // Export commonly used use cases that might be needed by other modules
        GetCompanyByIdUseCase,
        DownloadOnePagerUseCase,
        // Export IAutomationRepository for other modules
        {
            provide: "AutomationRepository",
            useClass: PrismaAutomationRepositoryAdapter,
        },
    ],
})
export class AutomationModule {}
