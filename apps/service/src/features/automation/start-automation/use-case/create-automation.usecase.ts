import { Injectable, Logger } from "@nestjs/common"
import { Usecase } from "@/shared/interfaces/usecase"
import { GetCompanyByIdUseCase } from "./get-company-by-id.usecase"
import { CheckCompanyHasProcessingAutomationUseCase } from "./check-company-has-processing-automation.usecase"
import { randomUUID } from "crypto"

export interface CreateAutomationInput {
    companyId: string
}

export interface CreateAutomationOutput {
    automationId: string
    companyId: string
}

@Injectable()
export class CreateAutomationUseCase implements Usecase<
    CreateAutomationInput,
    CreateAutomationOutput
> {
    private readonly logger = new Logger(CreateAutomationUseCase.name)

    constructor(
        private readonly getCompanyByIdUseCase: GetCompanyByIdUseCase,
        private readonly checkCompanyHasProcessingAutomationUseCase: CheckCompanyHasProcessingAutomationUseCase,
    ) {}

    async execute(
        input: CreateAutomationInput,
    ): Promise<CreateAutomationOutput> {
        const { companyId } = input

        await this.getCompanyByIdUseCase.execute({ companyId })
        await this.checkCompanyHasProcessingAutomationUseCase.execute({
            companyId,
        })

        const automationId = randomUUID()

        this.logger.log(
            `Generated automationId ${automationId} for company ${companyId} (not persisted yet)`,
        )

        return { automationId, companyId }
    }
}
