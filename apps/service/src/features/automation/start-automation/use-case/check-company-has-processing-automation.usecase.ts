import { Injectable, Inject } from "@nestjs/common"
import { IAutomationRepository } from "@/shared/repository/automation-repository.interface"
import { Usecase } from "@/shared/interfaces/usecase"
import { AutomationAlreadyInProgressError } from "../domain/errors/automation-errors"

export interface CheckCompanyHasProcessingAutomationInput {
    companyId: string
}

export interface CheckCompanyHasProcessingAutomationOutput {
    hasProcessing: boolean
}

@Injectable()
export class CheckCompanyHasProcessingAutomationUseCase
    implements
        Usecase<
            CheckCompanyHasProcessingAutomationInput,
            CheckCompanyHasProcessingAutomationOutput
        >
{
    constructor(
        @Inject("AutomationRepository")
        private readonly automationRepository: IAutomationRepository,
    ) {}

    async execute(
        input: CheckCompanyHasProcessingAutomationInput,
    ): Promise<CheckCompanyHasProcessingAutomationOutput> {
        const alreadyExitsAutomationForCompany =
            await this.automationRepository.findProcessingByCompanyId(
                input.companyId,
            )

        if (alreadyExitsAutomationForCompany) {
            throw new AutomationAlreadyInProgressError()
        }
        return { hasProcessing: false }
    }
}
