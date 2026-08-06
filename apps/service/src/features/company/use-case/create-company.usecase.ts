import { Injectable, Inject } from "@nestjs/common"
import { CompanyRepository } from "@/shared/repository/company-repository.interface"
import { CreateCompanyDto } from "@/features/company/data/dtos"
import { CompanyNameAlreadyExistsError } from "@/features/company/domain/errors/company-errors"
import { Usecase } from "@/shared/interfaces/usecase"

export interface CreateCompanyInput {
    name: string
    userId: string
}

export interface CreateCompanyOutput {
    message: string
}

@Injectable()
export class CreateCompanyUseCase implements Usecase<
    CreateCompanyInput,
    CreateCompanyOutput
> {
    constructor(
        @Inject("CompanyRepository")
        private readonly companyRepository: CompanyRepository,
    ) {}

    async execute(input: CreateCompanyInput): Promise<CreateCompanyOutput> {
        // Uniqueness is global, not per-owner. Storage paths are namespaced by
        // company name, so allowing two tenants to both own an "Acme" would put
        // their documents under the same prefix. Namespacing storage by company
        // id instead would let this be per-owner — see README known issues.
        const existingCompany = await this.companyRepository.findByNameAsSystem(
            input.name,
        )

        if (existingCompany) {
            throw new CompanyNameAlreadyExistsError()
        }

        await this.companyRepository.create({
            name: input.name,
            ownerId: input.userId,
        })

        return {
            message: "Empresa criada com sucesso!",
        }
    }
}
