import { Injectable, Inject, Logger } from "@nestjs/common"
import { AgentDocument, AgentGateway } from "../gateway/agent-gateway.interface"
import { Usecase } from "@/shared/interfaces/usecase"
import {
    Automation,
    AutomationStatus,
} from "@/shared/domain/entities/automation.entity"
import { AutomationStatusValidator } from "@/shared/validators/automation-status-validator"
import { UploadedDocument } from "./automation-upload.usecase"
import { AutomationRepository } from "../domain/repository/automation-repository.interface"
import { AutomationCannotStartTriageError } from "@/features/automation/start-automation/domain/errors/automation-errors"

export interface NotifyAgentWithDocumentsInput {
    automation: Automation
    companyName: string
    documents: AgentDocument[]
}

export interface NotifyAgentWithDocumentsOutput {
    automation: Automation
    agentResponse: any
}

@Injectable()
export class NotifyAgentWithDocumentsUseCase implements Usecase<
    NotifyAgentWithDocumentsInput,
    NotifyAgentWithDocumentsOutput
> {
    private readonly logger = new Logger(NotifyAgentWithDocumentsUseCase.name)

    constructor(
        @Inject("AutomationRepository")
        private readonly automationRepository: AutomationRepository,
        @Inject("AgentGateway") private readonly agentGateway: AgentGateway,
    ) {}

    async execute(
        input: NotifyAgentWithDocumentsInput,
    ): Promise<NotifyAgentWithDocumentsOutput> {
        const { automation, companyName, documents } = input

        try {
            if (!AutomationStatusValidator.canStartTriage(automation)) {
                throw new AutomationCannotStartTriageError()
            }

            await this.automationRepository.updateStatus(
                automation.id,
                AutomationStatus.PROCESSING,
            )

            // Atualizar a entidade local com o novo status
            const processingAutomation = automation.updateStatus(
                AutomationStatus.PROCESSING,
            )

            // Chamar o agente após atualizar o status
            await this.agentGateway.startAgentAutomation({
                company_name: companyName,
                company_id: automation.companyId,
                automation_id: automation.id,
                documents: documents,
            })

            return {
                automation: processingAutomation, // Retornar automação com status atualizado
                agentResponse: {
                    status: AutomationStatus.PROCESSING,
                    message: "Automation is being processed by the agent.",
                },
            }
        } catch (err) {
            this.logger.log("Payload", {
                company_name: companyName,
                company_id: automation.companyId,
                automation_id: automation.id,
                documents: documents,
            })

            this.logger.error("Agent call failed", err?.stack || err)

            await this.automationRepository.updateStatus(
                automation.id,
                AutomationStatus.FAILED,
            )

            const failedAutomation = automation.updateStatus(
                AutomationStatus.FAILED,
            )

            return {
                automation: failedAutomation,
                agentResponse: {
                    status: AutomationStatus.FAILED,
                    message: "Automation failed to start with the agent.",
                },
            }
        }
    }
}
