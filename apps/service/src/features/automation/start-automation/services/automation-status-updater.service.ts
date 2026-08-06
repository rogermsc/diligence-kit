import { Injectable, Inject, Logger } from "@nestjs/common"
import { EventBusPort } from "@/shared/domain/interfaces/event-bus.interface"
import { AutomationStatus } from "@/shared/domain/entities/automation.entity"
import { AutomationUpdatedEvent } from "../domain/events/automation.events"
import { AutomationRepository } from "@/features/automation/start-automation/domain/repository/automation-repository.interface"

@Injectable()
export class AutomationStatusUpdaterService {
    private readonly logger = new Logger(AutomationStatusUpdaterService.name)

    constructor(
        @Inject("AutomationRepository")
        private readonly automationRepository: AutomationRepository,
        @Inject("EventBusPort")
        private readonly eventBus: EventBusPort,
    ) {}

    /**
     * Atualiza o status de uma automação e emite evento
     */
    async updateAutomationStatus(
        automationId: string,
        status: AutomationStatus,
        reason?: string,
    ): Promise<void> {
        try {
            this.logger.log(`Updating automation status to ${status}`, {
                automationId,
                status,
                reason,
            })

            // Atualizar status no banco
            await this.automationRepository.updateStatus(automationId, status)

            // Emitir evento de atualização
            await this.eventBus.emit("automation.updated", {
                automationId,
                status,
            })

            this.logger.log(`Automation status updated successfully`, {
                automationId,
                status,
            })
        } catch (error) {
            this.logger.error(`Failed to update automation status`, {
                automationId,
                status,
                error: error.message,
            })
            throw error
        }
    }

    /**
     * Marca automação como failed devido a ZIP inválido
     */
    async markAsFailed(automationId: string, reason: string): Promise<void> {
        await this.updateAutomationStatus(
            automationId,
            AutomationStatus.FAILED,
            reason,
        )
    }
}
