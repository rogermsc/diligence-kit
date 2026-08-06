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
        // Scoped to the caller. Asking globally is what leaked the existence of
        // other tenants' company names: being refused told you one existed.
        // The database enforces the same rule per owner, so this is a friendlier
        // error rather than the guarantee.
        const existingCompany = await this.companyRepository.findByNameForOwner(
            input.name,
            input.userId,
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
