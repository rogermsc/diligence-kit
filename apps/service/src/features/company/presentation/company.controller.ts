import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    UseGuards,
    Res,
    Delete,
    HttpCode,
    HttpStatus,
    Req,
} from "@nestjs/common"
import { Request, Response } from "express"
import { UserJwt } from "@/features/auth/domain/interfaces/token-manager.interface"
import { Tenancy, NoTenancy } from "@/shared/tenancy/tenancy.decorator"
import { RequestValidator } from "@/shared/validators/request-validator"
import {
    CreateCompanyDto,
    CreateCompanySchema,
    CompanyIdDto,
    CompanyIdSchema,
} from "@/features/company/data/dtos"
import { z } from "zod"
import { CreateCompanyUseCase } from "@/features/company/use-case/create-company.usecase"
import { ListCompaniesUseCase } from "@/features/company/use-case/list-companies.usecase"
import { GetCompanyDetailsUseCase } from "@/features/company/use-case/get-company-details.usecase"
import { GetCompanyOnePagerUseCase } from "../use-case/get-company-one-pager.usecase"
import { GetCompanyAnalysisUseCase } from "../use-case/get-company-analysis.usecase"
import { DeleteCompanyUseCase } from "../use-case/delete-company.usecase"
import { AuthGuard } from "@/features/auth/guards/auth.guard"
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger"
import {
    ApiCreateCompany,
    ApiListCompanies,
    ApiGetCompanyDetails,
    ApiGetCompanyOnePager,
    ApiDeleteCompany,
} from "@/shared/decorators"

interface AuthenticatedRequest extends Request {
    user: UserJwt
}

@ApiTags("Company")
@ApiBearerAuth("access-token")
@Controller("company")
@UseGuards(AuthGuard)
export class CompanyController {
    constructor(
        private readonly createCompanyUseCase: CreateCompanyUseCase,
        private readonly listCompaniesUseCase: ListCompaniesUseCase,
        private readonly getCompanyDetailsUseCase: GetCompanyDetailsUseCase,
        private readonly getCompanyOnePagerUseCase: GetCompanyOnePagerUseCase,
        private readonly getCompanyAnalysisUseCase: GetCompanyAnalysisUseCase,
        private readonly deleteCompanyUseCase: DeleteCompanyUseCase,
    ) {}

    @Post()
    @ApiCreateCompany()
    @NoTenancy("creates the record; the new company is owned by the caller")
    async create(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
        const input = RequestValidator.validate<CreateCompanyDto>(
            body,
            CreateCompanySchema,
        )
        return this.createCompanyUseCase.execute({
            ...input,
            userId: req.user.id,
        })
    }

    @Get()
    @ApiListCompanies()
    @NoTenancy("the repository scopes the list to the caller's ownerId")
    async findAll(@Req() req: AuthenticatedRequest) {
        return this.listCompaniesUseCase.execute({ userId: req.user.id })
    }

    @Get(":id")
    @ApiGetCompanyDetails()
    @Tenancy({ company: "param:id" })
    async findById(@Param() params: unknown, @Req() req: AuthenticatedRequest) {
        const { id } = RequestValidator.validate<CompanyIdDto>(
            params,
            CompanyIdSchema,
        )
        return this.getCompanyDetailsUseCase.execute({
            id,
            userId: req.user.id,
        })
    }
    @Get("automation/:automationId/analysis")
    @Tenancy({ automation: "param:automationId" })
    async getAnalysis(@Param() params: unknown) {
        const { automationId } = RequestValidator.validate(
            params,
            z.object({
                automationId: z.string().uuid("Invalid automation ID format"),
            }),
        )
        return this.getCompanyAnalysisUseCase.execute({ automationId })
    }

    @Get("automation/:automationId/one-pager")
    @ApiGetCompanyOnePager()
    @Tenancy({ automation: "param:automationId" })
    async getOnePager(@Param() params: unknown, @Res() res: Response) {
        const AutomationIdSchema = z.object({
            automationId: z.string().uuid("Invalid automation ID format"),
        })

        const { automationId } = RequestValidator.validate(
            params,
            AutomationIdSchema,
        )

        const { fileName, fileBuffer, mimeType } =
            await this.getCompanyOnePagerUseCase.execute({ id: automationId })

        res.set({
            "Content-Type": mimeType,
            "Content-Disposition": `attachment; filename="${fileName}"`,
            "Content-Length": fileBuffer.length,
        })

        res.send(fileBuffer)
    }

    @Delete(":id")
    @Tenancy({ company: "param:id" })
    @HttpCode(HttpStatus.OK)
    @ApiDeleteCompany()
    async delete(@Param() params: unknown, @Req() req: AuthenticatedRequest) {
        const { id } = RequestValidator.validate<CompanyIdDto>(
            params,
            CompanyIdSchema,
        )
        return this.deleteCompanyUseCase.execute({ id, userId: req.user.id })
    }
}
