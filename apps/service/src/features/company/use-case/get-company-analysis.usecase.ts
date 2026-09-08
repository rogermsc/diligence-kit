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
import type { OverrideRepository } from "@/features/overrides/domain/repository/override-repository.interface"
import { resolveEffective } from "@/features/overrides/use-case/list-overrides.usecase"
import {
    mergeOverrides,
    type MergedAnalysis,
} from "@/features/overrides/domain/merge-overrides"
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
    /**
     * Values a person changed, with the reason and who gave it. Null when
     * nobody has overridden anything.
     */
    overrides: MergedAnalysis["overrides"]
    /** Notes attached to the run that change no value. */
    annotations: MergedAnalysis["annotations"]
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
        @Inject("OverrideRepository")
        private readonly overrides: OverrideRepository,
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

        // The merge the schema has always described. Judgement is stored beside
        // the analysis, never inside it, so the model's own output stays exactly
        // as it was produced and a reader can see which values a person changed
        // and why.
        const history = await this.overrides.listByAutomation(
            input.automationId,
        )
        const merged = mergeOverrides(
            onePager.analysis ?? null,
            resolveEffective(history),
            history.filter((row) => row.targetType === "ANNOTATION"),
        )

        return {
            automationId: input.automationId,
            onePagerUrl: onePager.url,
            analysis: merged.analysis,
            overrides: merged.overrides,
            annotations: merged.annotations,
        }
    }
}
