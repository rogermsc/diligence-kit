import { Injectable, Inject } from "@nestjs/common"
import { Usecase } from "@/shared/interfaces/usecase"
import { IAutomationRepository } from "@/shared/repository/automation-repository.interface"
import {
    UpdateAutomationStatusInput,
    UpdateAutomationStatusOutput,
} from "../data/dtos/update-automation-status.schema"
import { AutomationNotFoundError } from "../domain/errors/automation-errors"

@Injectable()
export class UpdateAutomationStatusUseCase implements Usecase<
    UpdateAutomationStatusInput,
    UpdateAutomationStatusOutput
> {
    constructor(
        @Inject("AutomationRepository")
        private readonly automationRepository: IAutomationRepository,
    ) {}

    async execute(
        input: UpdateAutomationStatusInput,
    ): Promise<UpdateAutomationStatusOutput> {
        const { automationId, status } = input

        const automation =
            await this.automationRepository.findById(automationId)

        if (!automation) {
            throw new AutomationNotFoundError()
        }

        await this.automationRepository.updateStatus(automationId, status)

        return {
            message: `Automation status updated to ${status}`,
            automation: {
                id: automationId,
                status,
            },
        }
    }
}
