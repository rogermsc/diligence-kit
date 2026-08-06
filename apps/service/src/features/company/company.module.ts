import { Module } from "@nestjs/common"
import { CompanyController } from "./presentation/company.controller"
import { PrismaCompanyRepositoryAdapter } from "@/shared/infra/adapters/prisma-company-repository.adapter"
import { CreateCompanyUseCase } from "./use-case/create-company.usecase"
import { ListCompaniesUseCase } from "./use-case/list-companies.usecase"
import { GetCompanyDetailsUseCase } from "./use-case/get-company-details.usecase"
import { GetCompanyOnePagerUseCase } from "./use-case/get-company-one-pager.usecase"
import { DeleteCompanyUseCase } from "./use-case/delete-company.usecase"
import { AuthModule } from "@/features/auth/auth.module"
import { MarkdownFileHelper } from "./domain/helpers/markdown-file.helper"
import { StorageFileReaderAdapter } from "./domain/interfaces/storage-file-reader.adapter"
import { AutomationModule as StartAutomationModule } from "@/features/automation/start-automation/automation.module" // ✅ Módulo correto

@Module({
    imports: [AuthModule, StartAutomationModule],
    controllers: [CompanyController],
    providers: [
        {
            provide: "CompanyRepository",
            useClass: PrismaCompanyRepositoryAdapter,
        },
        {
            provide: "FileReaderService",
            useClass: StorageFileReaderAdapter,
        },
        CreateCompanyUseCase,
        ListCompaniesUseCase,
        GetCompanyDetailsUseCase,
        GetCompanyOnePagerUseCase,
        DeleteCompanyUseCase,
        MarkdownFileHelper,
        StorageFileReaderAdapter,
    ],
    exports: [
        {
            provide: "CompanyRepository",
            useClass: PrismaCompanyRepositoryAdapter,
        },
        CreateCompanyUseCase,
        ListCompaniesUseCase,
        GetCompanyDetailsUseCase,
        GetCompanyOnePagerUseCase,
        DeleteCompanyUseCase,
        MarkdownFileHelper,
    ],
})
export class CompanyModule {}
