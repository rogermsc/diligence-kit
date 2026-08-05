import { Controller, Post, Body, Logger, UseGuards, Inject } from '@nestjs/common';
import { AgentGuard } from '@/features/auth/guards/agent.guard';
import { WebhookSignatureGuard } from '@/features/auth/guards/webhook-signature.guard';
import { DelegateSpecificProcessReportUseCase } from '@/features/onePager-agent/report/use-cases/delegate-process-report.usecase';
import { VerifyAllReportsAreReceivedUseCase } from '@/features/onePager-agent/report/use-cases/verify-all-reports-are-received.usecase';
import { ReportCompletedUseCase } from '@/features/onePager-agent/report/use-cases/report-completed.usecase';
import { reportPayloadSchema } from '@/features/onePager-agent/report/data/dtos/report-payload.schema';
import { PayloadValidator } from '@/shared/validators/payload-validator';
import { IAutomationRepository } from '@/shared/repository/automation-repository.interface';
import { AutomationStatus } from '@/shared/domain/entities/automation.entity';

@Controller('automation')
@UseGuards(AgentGuard, WebhookSignatureGuard)
export class CompleteReportController {
    private readonly logger = new Logger(CompleteReportController.name);

    constructor(
        private readonly processReportUseCase: DelegateSpecificProcessReportUseCase,
        private readonly verifyAllReportsAreReceivedUseCase: VerifyAllReportsAreReceivedUseCase,
        private readonly reportCompletedUseCase: ReportCompletedUseCase,
        @Inject('AutomationRepository')
        private readonly automationRepository: IAutomationRepository,
    ) { }

    @Post('complete-report')
    async completeReport(@Body() payload: {
        automationId: string;
        domain: string;
        status: string;
        reportUrl?: string;
    }) {
        this.logger.log(`Received complete-report HTTP callback`, {
            automationId: payload.automationId,
            domain: payload.domain,
            status: payload.status,
        });

        const validatedPayload = PayloadValidator.validateWithErrorHandling(
            payload,
            reportPayloadSchema,
            'CompleteReportHTTP',
            this.logger,
        );

        await this.processReportUseCase.execute(validatedPayload);

        const isIncrementalEnabled = process.env.ONEPAGER_INCREMENTAL_ENABLED === 'true';

        if (!isIncrementalEnabled) {
            this.logger.log(`OnePager incremental feature disabled. Skipping completion check for automation ${validatedPayload.automationId}`);
            return { message: 'Report processed', automationId: payload.automationId };
        }

        const allReportsReceived = await this.verifyAllReportsAreReceivedUseCase.execute({
            automationId: validatedPayload.automationId,
        });

        if (allReportsReceived) {
            this.logger.log(`All reports received! Triggering completion for automation ${validatedPayload.automationId}`);
            await this.reportCompletedUseCase.execute({
                automationId: validatedPayload.automationId,
            });
        }

        return { message: 'Report processed', automationId: payload.automationId };
    }

    @Post('complete-report-error')
    async completeReportError(@Body() payload: {
        automationId: string;
        domain: string;
        status: string;
        error: string;
    }) {
        this.logger.error(`Agent reported error for automation ${payload.automationId}: ${payload.error}`, {
            domain: payload.domain,
        });

        await this.automationRepository.updateStatus(payload.automationId, AutomationStatus.FAILED);

        this.logger.log(`Automation ${payload.automationId} marked as FAILED`);
        return { message: 'Error acknowledged, automation marked as FAILED', automationId: payload.automationId };
    }
}
