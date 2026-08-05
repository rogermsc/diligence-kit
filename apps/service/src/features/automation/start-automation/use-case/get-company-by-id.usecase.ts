import { Injectable, Inject } from "@nestjs/common"
import { CompanyRepository } from "@/shared/repository/company-repository.interface"
import { Company } from "@/shared/domain/entities/company.entity"
import { Usecase } from "@/shared/interfaces/usecase"
import { CompanyNotFoundError } from "@/features/company/domain/errors/company-errors"

export interface GetCompanyByIdInput {
    companyId: string
}

export interface GetCompanyByIdOutput {
    company: Company
}

@Injectable()
export class GetCompanyByIdUseCase
    implements Usecase<GetCompanyByIdInput, GetCompanyByIdOutput>
{
    constructor(
        @Inject("CompanyRepository")
        private readonly companyRepository: CompanyRepository,
    ) {}

    async execute(input: GetCompanyByIdInput): Promise<GetCompanyByIdOutput> {
        const company = await this.companyRepository.findById(input.companyId)
        if (!company) {
            throw new CompanyNotFoundError()
        }
        return { company }
    }
}
