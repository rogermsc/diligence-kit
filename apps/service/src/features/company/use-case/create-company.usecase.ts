import { Injectable, Inject } from "@nestjs/common"
import { CompanyRepository } from "@/shared/repository/company-repository.interface"
import { CreateCompanyDto } from "@/features/company/data/dtos"
import { CompanyNameAlreadyExistsError } from "@/features/company/domain/errors/company-errors"
import { Usecase } from "@/shared/interfaces/usecase"

export interface CreateCompanyInput {
    name: string
}

export interface CreateCompanyOutput {
    message: string
}

@Injectable()
export class CreateCompanyUseCase
    implements Usecase<CreateCompanyInput, CreateCompanyOutput>
{
    constructor(
        @Inject("CompanyRepository")
        private readonly companyRepository: CompanyRepository,
    ) {}

    async execute(input: CreateCompanyInput): Promise<CreateCompanyOutput> {
        const existingCompany = await this.companyRepository.findByName(
            input.name,
        )

        if (existingCompany) {
            throw new CompanyNameAlreadyExistsError()
        }

        await this.companyRepository.create(input)

        return {
            message: "Empresa criada com sucesso!",
        }
    }
}
