import {
    Controller,
    Post,
    Body,
    Logger,
    UseGuards,
    Inject,
} from "@nestjs/common"
import { AgentGuard } from "@/features/auth/guards/agent.guard"
import { WebhookSignatureGuard } from "@/features/auth/guards/webhook-signature.guard"
import { DelegateSpecificProcessReportUseCase } from "@/features/onePager-agent/report/use-cases/delegate-process-report.usecase"
import { reportPayloadSchema } from "@/features/onePager-agent/report/data/dtos/report-payload.schema"
import { PayloadValidator } from "@/shared/validators/payload-validator"
import { IAutomationRepository } from "@/shared/repository/automation-repository.interface"
import { AutomationStatus } from "@/shared/domain/entities/automation.entity"

@Controller("automation")
@UseGuards(AgentGuard, WebhookSignatureGuard)
export class CompleteReportController {
    private readonly logger = new Logger(CompleteReportController.name)

    constructor(
        private readonly processReportUseCase: DelegateSpecificProcessReportUseCase,
        @Inject("AutomationRepository")
        private readonly automationRepository: IAutomationRepository,
    ) {}

    @Post("complete-report")
    async completeReport(
        @Body()
        payload: {
            automationId: string
            domain: string
            status: string
            reportUrl?: string
        },
    ) {
        this.logger.log(`Received complete-report HTTP callback`, {
            automationId: payload.automationId,
            domain: payload.domain,
            status: payload.status,
        })

        const validatedPayload = PayloadValidator.validateWithErrorHandling(
            payload,
            reportPayloadSchema,
            "CompleteReportHTTP",
            this.logger,
        )

        await this.processReportUseCase.execute(validatedPayload)

        // The "all four reports are in" branch used to live here, behind
        // ONEPAGER_INCREMENTAL_ENABLED. It could never fire: it counted reports
        // per automation id, and each domain is its own automation row with a
        // unique (automationId, domain) constraint, so the count never exceeded
        // one. The use case it called only logged.
        return {
            message: "Report processed",
            automationId: payload.automationId,
        }
    }

    @Post("complete-report-error")
    async completeReportError(
        @Body()
        payload: {
            automationId: string
            domain: string
            status: string
            error: string
        },
    ) {
        this.logger.error(
            `Agent reported error for automation ${payload.automationId}: ${payload.error}`,
            {
                domain: payload.domain,
            },
        )

        await this.automationRepository.updateStatus(
            payload.automationId,
            AutomationStatus.FAILED,
        )

        this.logger.log(`Automation ${payload.automationId} marked as FAILED`)
        return {
            message: "Error acknowledged, automation marked as FAILED",
            automationId: payload.automationId,
        }
    }
}
