import { Injectable, Inject } from "@nestjs/common"
import { CompanyRepository } from "@/shared/repository/company-repository.interface"
import { CompanyNotFoundError } from "@/features/company/domain/errors/company-errors"
import { CompanyDetailsResponseDTO } from "@/features/company/data/dtos/company-details.schema"
import { Usecase } from "@/shared/interfaces/usecase"
import { CompanyDetailsMapper } from "@/shared/domain/mappers/company-details.mapper"

export interface GetCompanyDetailsInput {
    id: string
}

export interface GetCompanyDetailsOutput {
    message: string
    data: CompanyDetailsResponseDTO
}

@Injectable()
export class GetCompanyDetailsUseCase
    implements Usecase<GetCompanyDetailsInput, CompanyDetailsResponseDTO>
{
    constructor(
        @Inject("CompanyRepository")
        private readonly companyRepository: CompanyRepository,
    ) {}

    async execute(
        input: GetCompanyDetailsInput,
    ): Promise<CompanyDetailsResponseDTO> {
        const companyWithAutomations =
            await this.companyRepository.findByIdWithAutomations(input.id)

        if (!companyWithAutomations) {
            throw new CompanyNotFoundError()
        }

        const response = CompanyDetailsMapper.toResponse(companyWithAutomations)

        return response
    }
}
