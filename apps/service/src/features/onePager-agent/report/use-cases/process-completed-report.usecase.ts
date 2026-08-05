import { Injectable, Logger, Inject } from '@nestjs/common';
import { ReportPayload } from '../domain/interfaces/report-payload.interface';
import { ReportProcessor } from '../domain/interfaces/report-processor.interface';
import { IAutomationRepository } from '@/shared/repository/automation-repository.interface';
import { AutomationStatus, Automation } from '@/shared/domain/entities/automation.entity';
import { ReportCompletedUrlNotFoundError } from '@/shared/errors/report-errors';

@Injectable()
export class ProcessCompletedReportUseCase implements ReportProcessor {
    private readonly logger = new Logger(ProcessCompletedReportUseCase.name);

    constructor(
        @Inject('AutomationRepository')
        private readonly automationRepository: IAutomationRepository,
    ) { }

    async execute(payload: ReportPayload, reportAutomation: Automation): Promise<void> {
        this.logger.log(`📝 Processing COMPLETED report`);

        if (!payload.reportUrl) {
            throw new ReportCompletedUrlNotFoundError();
        }

        try {
            const report = await this.automationRepository.updateAutomationWithReport({
                automationId: payload.automationId,
                automationStatus: AutomationStatus.COMPLETED,
                reportData: {
                    companyId: reportAutomation.companyId,
                    domain: payload.domain,
                    reportUrl: payload.reportUrl
                }
            });

            this.logger.log(`🎉 COMPLETED report processed successfully`, {
                reportId: report?.getId(),
                automationId: payload.automationId,
                domain: payload.domain
            });

        } catch (error) {
            this.logger.error(`❌ Error processing COMPLETED report: ${error.message}`, {
                automationId: payload.automationId,
                domain: payload.domain,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
}
