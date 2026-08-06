import { Injectable, Logger, Inject } from "@nestjs/common"
import { ReportPayload } from "../domain/interfaces/report-payload.interface"
import { IAutomationRepository } from "@/shared/repository/automation-repository.interface"
import { AutomationNotFoundError } from "@/features/automation/start-automation/domain/errors/automation-errors"
import { InvalidAutomationDomainError } from "@/shared/errors/report-errors"
import { SectorDomainMapperHelper } from "@/shared/domain/mappers/sector-domain-mapper.helper"
import { ReportProcessorFactory } from "../factories/report-processor.factory"

@Injectable()
export class DelegateSpecificProcessReportUseCase {
    private readonly logger = new Logger(
        DelegateSpecificProcessReportUseCase.name,
    )

    constructor(
        @Inject("AutomationRepository")
        private readonly automationRepository: IAutomationRepository,
        private readonly reportProcessorFactory: ReportProcessorFactory,
    ) {}

    async execute(payload: ReportPayload): Promise<void> {
        this.logger.log(`📥 Processing report received from agents`, {
            automationId: payload.automationId,
            domain: payload.domain,
            reportUrl: payload.reportUrl,
            status: payload.status,
        })

        try {
            const reportAutomation = await this.automationRepository.findById(
                payload.automationId,
            )

            if (!reportAutomation) {
                this.logger.error(
                    `❌ Automation not found: ${payload.automationId}`,
                )
                throw new AutomationNotFoundError()
            }

            const expectedStage = SectorDomainMapperHelper.mapDomainToStage(
                payload.domain,
            )

            const isAgentTypeValidByStage =
                reportAutomation.stage === expectedStage

            if (!isAgentTypeValidByStage) {
                this.logger.error(
                    `❌ Agent type does not match automation stage`,
                    {
                        automationId: payload.automationId,
                        automationStage: reportAutomation.stage,
                        agentDomain: payload.domain,
                        expectedStage,
                    },
                )
                throw new InvalidAutomationDomainError(
                    payload.automationId,
                    payload.domain,
                )
            }

            const processor = this.reportProcessorFactory.create(payload.status)

            await processor.execute(payload, reportAutomation)
        } catch (error) {
            this.logger.error(`❌ Error processing report: ${error.message}`, {
                automationId: payload.automationId,
                domain: payload.domain,
                status: payload.status,
                error: error.message,
                stack: error.stack,
            })
            throw error
        }
    }
}
