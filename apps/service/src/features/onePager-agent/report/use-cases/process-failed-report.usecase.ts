import { Injectable, Logger, Inject } from '@nestjs/common';
import { ReportPayload } from '../domain/interfaces/report-payload.interface';
import { ReportProcessor } from '../domain/interfaces/report-processor.interface';
import { IAutomationRepository } from '@/shared/repository/automation-repository.interface';
import { AutomationStatus, Automation } from '@/shared/domain/entities/automation.entity';

@Injectable()
export class ProcessFailedReportUseCase implements ReportProcessor {
    private readonly logger = new Logger(ProcessFailedReportUseCase.name);

    constructor(
        @Inject('AutomationRepository')
        private readonly automationRepository: IAutomationRepository,
    ) { }

    async execute(payload: ReportPayload, reportAutomation: Automation): Promise<void> {
        this.logger.log(`⚠️ Processing FAILED report`, {
            automationId: payload.automationId,
            domain: payload.domain,
            reportUrl: payload.reportUrl
        });

        try {
            // Update automation to FAILED (no report creation) using transactional method
            await this.automationRepository.updateAutomationWithReport({
                automationId: payload.automationId,
                automationStatus: AutomationStatus.FAILED
            });

            this.logger.log(`🔴 FAILED report processed successfully`, {
                automationId: payload.automationId,
                domain: payload.domain,
                action: 'automation_marked_as_failed'
            });

        } catch (error) {
            this.logger.error(`❌ Error processing FAILED report: ${error.message}`, {
                automationId: payload.automationId,
                domain: payload.domain,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
}