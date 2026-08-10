import { Inject, Injectable } from "@nestjs/common"

import {
    AutomationNotFoundError,
    InvalidAutomationStageError,
} from "@/features/report-agents/domain/errors/report-agent.errors"
import { OnePagerNotFoundError } from "@/features/company/domain/errors/company-errors"
import {
    AutomationStageDomain,
    AutomationStatus,
} from "@/shared/domain/entities/automation.entity"
import { IAutomationRepository } from "@/shared/repository/automation-repository.interface"
import { Usecase } from "@/shared/interfaces/usecase"

export interface GetCompanyAnalysisInput {
    automationId: string
}

export interface GetCompanyAnalysisOutput {
    automationId: string
    onePagerUrl: string
    /**
     * Null for runs that completed before the analysis was persisted. Not an
     * error: the PDF is still there and the caller falls back to the download.
     */
    analysis: unknown
}

/**
 * The structured analysis behind the one-pager.
 *
 * Sits beside the existing `/one-pager` route, which streams the rendered PDF.
 * This one returns what the PDF was rendered from — the facts with their
 * sources and quotes, the resolved conflicts, the scorecard — so a client can
 * show the reasoning rather than a download link.
 */
@Injectable()
export class GetCompanyAnalysisUseCase implements Usecase<
    GetCompanyAnalysisInput,
    GetCompanyAnalysisOutput
> {
    constructor(
        @Inject("AutomationRepository")
        private readonly automationRepository: IAutomationRepository,
    ) {}

    async execute(
        input: GetCompanyAnalysisInput,
    ): Promise<GetCompanyAnalysisOutput> {
        const automation = await this.automationRepository.findById(
            input.automationId,
        )
        if (!automation) {
            throw new AutomationNotFoundError()
        }

        // Same gate as the PDF route: the analysis only exists once triage has
        // finished, and a half-written one would be worse than none.
        if (
            automation.status !== AutomationStatus.COMPLETED ||
            automation.stage !== AutomationStageDomain.TRIAGE
        ) {
            throw new InvalidAutomationStageError()
        }

        const onePager =
            await this.automationRepository.findOnePagerByAutomationId(
                input.automationId,
            )
        if (!onePager) {
            throw new OnePagerNotFoundError(input.automationId)
        }

        return {
            automationId: input.automationId,
            onePagerUrl: onePager.url,
            analysis: onePager.analysis ?? null,
        }
    }
}
