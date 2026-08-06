import { Injectable, Inject, Logger } from "@nestjs/common"
import { ReportRepository } from "@/shared/repository/report-repository.interface"
import { Usecase } from "@/shared/interfaces/usecase"
import { AgentType } from "@/features/onePager-agent/agent/domain/agent-type"

export interface VerifyAllReportsAreReceivedInput {
    automationId: string
}

export interface VerifyAllReportsAreReceivedOutput {
    allReceived: boolean
    receivedCount: number
    expectedCount: number
    missingAgents: AgentType[]
}

@Injectable()
export class VerifyAllReportsAreReceivedUseCase implements Usecase<
    VerifyAllReportsAreReceivedInput,
    boolean
> {
    private readonly logger = new Logger(
        VerifyAllReportsAreReceivedUseCase.name,
    )
    private readonly EXPECTED_AGENTS = Object.values(AgentType)

    constructor(
        @Inject("ReportRepository")
        private readonly reportRepository: ReportRepository,
    ) {}

    async execute(input: VerifyAllReportsAreReceivedInput): Promise<boolean> {
        try {
            const { automationId } = input

            const allReportsReceived =
                await this.reportRepository.hasAllAgentReports(automationId)

            const existingReports =
                await this.reportRepository.findByAutomationId(automationId)

            const receivedAgents = existingReports.map((report) =>
                report.getDomain(),
            )

            const missingAgents = this.EXPECTED_AGENTS.filter(
                (agent) => !receivedAgents.includes(agent),
            )

            this.logger.log(`Reports verification result`, {
                automationId,
                allReceived: allReportsReceived,
                receivedCount: existingReports.length,
                expectedCount: this.EXPECTED_AGENTS.length,
                receivedAgents,
                missingAgents,
            })

            return allReportsReceived
        } catch (error) {
            this.logger.error(
                `❌ Error verifying reports for automation ${input.automationId}: ${error.message}`,
            )
            throw error
        }
    }
}
