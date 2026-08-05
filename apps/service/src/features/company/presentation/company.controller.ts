import { Body, Controller, Get, Param, Post, UseGuards, Res, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { RequestValidator } from '@/shared/validators/request-validator';
import {
    CreateCompanyDto,
    CreateCompanySchema,
    CompanyIdDto,
    CompanyIdSchema,
} from '@/features/company/data/dtos';
import { z } from 'zod';
import { CreateCompanyUseCase } from '@/features/company/use-case/create-company.usecase';
import { ListCompaniesUseCase } from '@/features/company/use-case/list-companies.usecase';
import { GetCompanyDetailsUseCase } from '@/features/company/use-case/get-company-details.usecase';
import { GetCompanyOnePagerUseCase } from '../use-case/get-company-one-pager.usecase';
import { DeleteCompanyUseCase } from '../use-case/delete-company.usecase';
import { AuthGuard } from '@/features/auth/guards/auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ApiCreateCompany, ApiListCompanies, ApiGetCompanyDetails, ApiGetCompanyOnePager, ApiDeleteCompany } from '@/shared/decorators';

@ApiTags('Company')
@ApiBearerAuth('access-token')
@Controller('company')
@UseGuards(AuthGuard)
export class CompanyController {
    constructor(
        private readonly createCompanyUseCase: CreateCompanyUseCase,
        private readonly listCompaniesUseCase: ListCompaniesUseCase,
        private readonly getCompanyDetailsUseCase: GetCompanyDetailsUseCase,
        private readonly getCompanyOnePagerUseCase: GetCompanyOnePagerUseCase,
        private readonly deleteCompanyUseCase: DeleteCompanyUseCase,
    ) { }

    @Post()
    @ApiCreateCompany()
    async create(@Body() body: unknown) {
        const input = RequestValidator.validate<CreateCompanyDto>(
            body,
            CreateCompanySchema,
        );
        return this.createCompanyUseCase.execute(input);
    }

    @Get()
    @ApiListCompanies()
    async findAll() {
        return this.listCompaniesUseCase.execute({});
    }

    @Get(':id')
    @ApiGetCompanyDetails()
    async findById(@Param() params: unknown) {
        const { id } = RequestValidator.validate<CompanyIdDto>(
            params,
            CompanyIdSchema,
        );
        return this.getCompanyDetailsUseCase.execute({ id });
    }
    @Get('automation/:automationId/one-pager')
    @ApiGetCompanyOnePager()
    async getOnePager(@Param() params: unknown, @Res() res: Response) {
        const AutomationIdSchema = z.object({
            automationId: z.string().uuid('Invalid automation ID format')
        });

        const { automationId } = RequestValidator.validate(
            params,
            AutomationIdSchema
        );

        const { fileName, fileBuffer, mimeType } = await this.getCompanyOnePagerUseCase.execute({ id: automationId });

        res.set({
            'Content-Type': mimeType,
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': fileBuffer.length,
        });

        res.send(fileBuffer);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiDeleteCompany()
    async delete(@Param() params: unknown) {
        const { id } = RequestValidator.validate<CompanyIdDto>(
            params,
            CompanyIdSchema,
        );
        return this.deleteCompanyUseCase.execute({ id });
    }
}
