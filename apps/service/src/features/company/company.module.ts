import { Module } from "@nestjs/common"
import { CompanyController } from "./presentation/company.controller"
import { PrismaCompanyRepositoryAdapter } from "@/shared/infra/adapters/prisma-company-repository.adapter"
import { CreateCompanyUseCase } from "./use-case/create-company.usecase"
import { ListCompaniesUseCase } from "./use-case/list-companies.usecase"
import { GetCompanyDetailsUseCase } from "./use-case/get-company-details.usecase"
import { GetCompanyOnePagerUseCase } from "./use-case/get-company-one-pager.usecase"
import { OverridesModule } from "@/features/overrides/overrides.module"
import { GetCompanyAnalysisUseCase } from "./use-case/get-company-analysis.usecase"
import { DeleteCompanyUseCase } from "./use-case/delete-company.usecase"
import { AuthModule } from "@/features/auth/auth.module"
import { AutomationModule as StartAutomationModule } from "@/features/automation/start-automation/automation.module" // ✅ Módulo correto

@Module({
    imports: [AuthModule, StartAutomationModule, OverridesModule],
    controllers: [CompanyController],
    providers: [
        {
            provide: "CompanyRepository",
            useClass: PrismaCompanyRepositoryAdapter,
        },
        CreateCompanyUseCase,
        ListCompaniesUseCase,
        GetCompanyDetailsUseCase,
        GetCompanyOnePagerUseCase,
        GetCompanyAnalysisUseCase,
        DeleteCompanyUseCase,
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
        GetCompanyAnalysisUseCase,
        DeleteCompanyUseCase,
    ],
})
export class CompanyModule {}
