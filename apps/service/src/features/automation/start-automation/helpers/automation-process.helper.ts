import { GetCompanyByIdUseCase } from "../use-case/get-company-by-id.usecase"
import { CheckCompanyHasProcessingAutomationUseCase } from "../use-case/check-company-has-processing-automation.usecase"
import {
    AutomationCompanyNotFoundError,
    AutomationAgentError,
} from "../domain/errors/automation-errors"

export class AutomationProcessHelper {
    static async findCompanyOrThrow(
        getCompanyByIdUseCase: GetCompanyByIdUseCase,
        companyId: string,
    ) {
        const result = await getCompanyByIdUseCase.execute({ companyId })

        const company = result.company

        if (!company) {
            throw new AutomationCompanyNotFoundError(companyId)
        }
        return { company }
    }

    static async checkProcessingAutomationOrThrow(
        checkCompanyHasProcessingAutomationUseCase: CheckCompanyHasProcessingAutomationUseCase,
        companyId: string,
    ) {
        await checkCompanyHasProcessingAutomationUseCase.execute({ companyId })
    }
}
