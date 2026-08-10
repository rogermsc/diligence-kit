import { Inject, Injectable } from "@nestjs/common"

import { Usecase } from "@/shared/interfaces/usecase"
import {
    AnalysisOverrideRecord,
    OverrideRepository,
} from "../domain/repository/override-repository.interface"

export interface ListOverridesInput {
    automationId: string
}

export interface ListOverridesOutput {
    /** Every row, oldest first — the trail exactly as written. */
    history: AnalysisOverrideRecord[]
    /**
     * The value overrides in force now: latest row per target, withdrawals
     * removed. A caller applying overrides to an analysis wants this one.
     */
    effective: AnalysisOverrideRecord[]
    /**
     * Notes, oldest first. Kept apart from `effective` because an annotation
     * changes no value — it carries only a rationale — and filtering the
     * effective set on "has a value" would otherwise silently discard every
     * one of them.
     */
    annotations: AnalysisOverrideRecord[]
}

@Injectable()
export class ListOverridesUseCase implements Usecase<
    ListOverridesInput,
    ListOverridesOutput
> {
    constructor(
        @Inject("OverrideRepository")
        private readonly overrides: OverrideRepository,
    ) {}

    async execute(input: ListOverridesInput): Promise<ListOverridesOutput> {
        const history = await this.overrides.listByAutomation(
            input.automationId,
        )
        return {
            history,
            effective: resolveEffective(history),
            annotations: history.filter((r) => r.targetType === "ANNOTATION"),
        }
    }
}

/**
 * Last write wins per target; a value-bearing target whose latest row has no
 * value has been withdrawn.
 *
 * Exported and pure so the merge-on-read path can reuse it without going
 * through the use case, and so it is testable without a database.
 */
export function resolveEffective(
    history: AnalysisOverrideRecord[],
): AnalysisOverrideRecord[] {
    const latest = new Map<string, AnalysisOverrideRecord>()
    // Oldest-first input, so a later row simply replaces an earlier one.
    for (const row of history) {
        if (row.targetType === "ANNOTATION") continue
        latest.set(`${row.targetType}:${row.targetKey}`, row)
    }
    return [...latest.values()].filter(
        (row) => row.value !== null && row.value !== undefined,
    )
}
