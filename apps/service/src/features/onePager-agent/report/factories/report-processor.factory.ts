import { Injectable } from "@nestjs/common"
import { ReportProcessor } from "../domain/interfaces/report-processor.interface"
import { ReportStatus } from "@/shared/domain/entities/report.entity"
import { ProcessCompletedReportUseCase } from "../use-cases/process-completed-report.usecase"
import { ProcessFailedReportUseCase } from "../use-cases/process-failed-report.usecase"
import { UnsupportedReportStatusError } from "@/shared/errors/report-errors"

@Injectable()
export class ReportProcessorFactory {
    constructor(
        private readonly processCompletedReportUseCase: ProcessCompletedReportUseCase,
        private readonly processFailedReportUseCase: ProcessFailedReportUseCase,
    ) {}

    create(status: ReportStatus): ReportProcessor {
        switch (status) {
            case ReportStatus.COMPLETED:
                return this.processCompletedReportUseCase

            case ReportStatus.FAILED:
                return this.processFailedReportUseCase

            default:
                throw new UnsupportedReportStatusError(status)
        }
    }
}
