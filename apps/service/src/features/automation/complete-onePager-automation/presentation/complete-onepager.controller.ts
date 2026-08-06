import {
    Controller,
    Post,
    Body,
    Logger,
    UseGuards,
    Inject,
} from "@nestjs/common"
import { CompleteOnePagerUseCase } from "../use-case/complete-onepager.usecase"
import { completeOnePagerSchema } from "../data/dtos/complete-onepager.schema"
import { PayloadValidator } from "@/shared/validators/payload-validator"
import { AgentGuard } from "@/features/auth/guards/agent.guard"
import { WebhookSignatureGuard } from "@/features/auth/guards/webhook-signature.guard"
import { AutomationRepository } from "@/features/automation/start-automation/domain/repository/automation-repository.interface"
import { AutomationStatus } from "@/shared/domain/entities/automation.entity"
import { DocumentRepository } from "@/shared/repository/document-repository.interface"

@Controller("automation")
@UseGuards(AgentGuard, WebhookSignatureGuard)
export class CompleteOnePagerController {
    private readonly logger = new Logger(CompleteOnePagerController.name)

    constructor(
        private readonly completeOnePagerUseCase: CompleteOnePagerUseCase,
        @Inject("AutomationRepository")
        private readonly automationRepository: AutomationRepository,
        @Inject("DocumentRepository")
        private readonly documentRepository: DocumentRepository,
    ) {}

    @Post("complete-onepager")
    async completeOnePager(
        @Body()
        payload: {
            automationId: string
            onePagerUrl: string
            fileIds?: { documentId: string; openaiFileId: string }[]
            coverage?: string[]
            missing?: string[]
        },
    ) {
        this.logger.log(`Received complete-onepager HTTP callback`, { payload })

        const validatedData = PayloadValidator.validateWithErrorHandling(
            {
                onePagerUrl: payload.onePagerUrl,
                coverage: payload.coverage,
                missing: payload.missing,
            },
            completeOnePagerSchema,
            "CompleteOnePagerHTTP",
            this.logger,
        )

        const result = await this.completeOnePagerUseCase.execute({
            automationId: payload.automationId,
            data: validatedData,
        })

        // Save OpenAI file IDs to documents for reuse in diligence stage
        if (payload.fileIds?.length) {
            try {
                await this.documentRepository.updateOpenaiFileIds(
                    payload.fileIds.map((f) => ({
                        id: f.documentId,
                        openaiFileId: f.openaiFileId,
                    })),
                )
                this.logger.log(
                    `Saved ${payload.fileIds.length} OpenAI file IDs for automation ${payload.automationId}`,
                )
            } catch (error) {
                this.logger.error(
                    `Failed to save OpenAI file IDs: ${error.message}`,
                )
            }
        }

        this.logger.log(
            `✅ OnePager completion via HTTP for automation ${payload.automationId}`,
        )
        return result
    }

    @Post("complete-onepager-error")
    async completeOnePagerError(
        @Body() payload: { automationId: string; error: string },
    ) {
        this.logger.error(
            `Agent reported error for automation ${payload.automationId}: ${payload.error}`,
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
