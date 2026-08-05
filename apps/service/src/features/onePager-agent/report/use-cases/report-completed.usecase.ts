import { Injectable, Inject, Logger } from "@nestjs/common";
import { Usecase } from "@/shared/interfaces/usecase";
import { ReportRepository } from "@/shared/repository/report-repository.interface";
import { ReportHelper } from "@/features/onePager-agent/report/helpers/report-helper";

export interface ReportCompletedInput {
    automationId: string;
}

@Injectable()
export class ReportCompletedUseCase implements Usecase<ReportCompletedInput, void> {
    private readonly logger = new Logger(ReportCompletedUseCase.name);

    constructor(
        @Inject('ReportRepository')
        private readonly reportRepository: ReportRepository,
    ) { }

    async execute(input: ReportCompletedInput): Promise<void> {
        try {
            const { automationId } = input;

            this.logger.log(`Processing report completion for automation: ${automationId}`);

            const reports = await this.reportRepository.findByAutomationId(automationId);

            if (reports.length === 0) {
                this.logger.warn(`No reports found for automation ${automationId}`);
                return;
            }

            const completedReports = reports.filter(report => ReportHelper.isCompleted(report));

            this.logger.log(`All reports completed for automation ${automationId}`, {
                totalReports: reports.length,
                completedReports: completedReports.length,
                domains: completedReports.map(r => r.getDomain()),
            });

        } catch (error) {
            this.logger.error(`Error processing report completion for automation ${input.automationId}: ${error.message}`);
            throw error;
        }
    }
}