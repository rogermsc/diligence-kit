import { Injectable, Inject } from "@nestjs/common"
import { CompanyRepository } from "@/shared/repository/company-repository.interface"
import {
    CompanyNotFoundError,
    CompanyDeletionFailedError,
} from "../domain/errors/company-errors"
import { Usecase } from "@/shared/interfaces/usecase"
import { RecordNotFoundError } from "@/shared/errors/db/data-base-error"

export interface DeleteCompanyInput {
    id: string
    userId: string
}

export interface DeleteCompanyOutput {
    success: boolean
    message: string
}

@Injectable()
export class DeleteCompanyUseCase implements Usecase<
    DeleteCompanyInput,
    DeleteCompanyOutput
> {
    constructor(
        @Inject("CompanyRepository")
        private readonly companyRepository: CompanyRepository,
    ) {}

    async execute(input: DeleteCompanyInput): Promise<DeleteCompanyOutput> {
        const { id, userId } = input

        const company = await this.companyRepository.findById(id, userId)

        if (!company) {
            throw new CompanyNotFoundError()
        }

        try {
            await this.companyRepository.delete(id, userId)

            return {
                success: true,
                message: `Company "${company.name}" and all related data deleted successfully`,
            }
        } catch (error) {
            // The repository raises a deliberate 404 when the owner-scoped delete
            // matches nothing (e.g. a concurrent delete). Preserve it.
            if (error instanceof RecordNotFoundError) throw error

            throw new CompanyDeletionFailedError(id, error.message)
        }
    }
}
