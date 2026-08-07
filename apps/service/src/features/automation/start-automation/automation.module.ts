import { Module } from "@nestjs/common"
import { AutomationController } from "./presentation/automation.controller"
import { GoogleStorageService } from "@/shared/services/google-storage.service"
import { LocalStorageService } from "@/shared/services/local-storage.service"
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

@Module({
    imports: [AuthModule],
    controllers: [AutomationController],
    providers: [
        // Use cases. The dashboard's upload is create -> upload-document (one
        // call per file) -> confirm; the browser expands the dataroom zip with
        // jszip before it posts, so nothing here unpacks archives or reassembles
        // chunks.
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

        // Storage and infrastructure
        {
            provide: "StorageService",
            // useFactory, not useClass: the decorator's argument is evaluated
            // when this module is first imported, which happens before main.ts
            // calls dotenv's config(). Reading the variable there meant a .env
            // STORAGE_DRIVER=local was always ignored and the GCS client was
            // bound instead — in what is advertised as a no-cloud-account run.
            useFactory: () =>
                process.env.STORAGE_DRIVER === "local"
                    ? new LocalStorageService()
                    : new GoogleStorageService(),
        },

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
