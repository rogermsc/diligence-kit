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
            analysis?: unknown
        },
    ) {
        // Deliberately not the payload. It now carries the whole analysis —
        // hundreds of kilobytes of verbatim quotes lifted out of a client's
        // confidential documents — and this line ran at INFO on every single
        // run, shipping all of it into the log sink.
        this.logger.log(
            `Received complete-onepager HTTP callback for ${payload.automationId}`,
            {
                facts: Object.keys(
                    (payload.analysis as { facts?: object })?.facts ?? {},
                ).length,
                documents: payload.fileIds?.length ?? 0,
            },
        )

        const validatedData = PayloadValidator.validateWithErrorHandling(
            {
                onePagerUrl: payload.onePagerUrl,
                coverage: payload.coverage,
                missing: payload.missing,
                // The validator is handed a hand-picked object rather than the
                // payload, so a field added to the schema and not to this list
                // is silently dropped while every test still passes.
                analysis: payload.analysis,
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

    /**
     * Liveness ping from the agent while a run is in flight.
     *
     * The reaper needs to tell a slow healthy run from an abandoned one, and
     * nothing else writes to the row between dispatch and completion. Signed and
     * agent-guarded like every other callback, so a client cannot use it to keep
     * a dead run alive.
     */
    @Post("heartbeat")
    async heartbeat(@Body() payload: { automationId: string }) {
        const updated = await this.automationRepository.recordHeartbeat(
            payload.automationId,
        )

        if (!updated) {
            // Not an error: the run may have completed or been failed already.
            this.logger.debug(
                `Heartbeat for ${payload.automationId} matched no processing run`,
            )
        }
        return { acknowledged: true }
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
