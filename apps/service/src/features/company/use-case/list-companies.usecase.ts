import { Injectable, Inject } from "@nestjs/common"
import { CompanyRepository } from "@/shared/repository/company-repository.interface"
import {
    CompanyMapper,
    CompanyListResponseDTO,
} from "@/shared/domain/mappers/company.mapper"

export interface ListCompaniesInput {
    // Pode ser expandido no futuro para paginação, filtros, etc.
}

export interface Usecase<I, O> {
    execute(input: I): Promise<O>
}

@Injectable()
export class ListCompaniesUseCase
    implements Usecase<ListCompaniesInput, CompanyListResponseDTO>
{
    constructor(
        @Inject("CompanyRepository")
        private readonly companyRepository: CompanyRepository,
    ) {}

    async execute(input: ListCompaniesInput): Promise<CompanyListResponseDTO> {
        const companiesWithAutomations = await this.companyRepository.findAllWithAutomations()
        const response = CompanyMapper.toResponseListWithAutomations(companiesWithAutomations)

        return response
    }
}
