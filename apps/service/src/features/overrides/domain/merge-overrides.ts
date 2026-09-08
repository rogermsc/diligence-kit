import type { AnalysisOverrideRecord } from "@/features/overrides/domain/repository/override-repository.interface"

/**
 * Lay a person's judgement over the model's analysis, saying which is which.
 *
 * The schema has claimed since the migration that added it that "the read
 * endpoint merges the two so every value can say whether it came from the model
 * or from a person". No such merge existed: overrides could be written, listed
 * and reverted, and nothing downstream ever read one. A correction changed
 * nothing on any screen and nothing in any document.
 *
 * The rule this follows is the one the product applies to a dataroom, turned on
 * its own users: a figure is worth what its source is worth, so a value that a
 * person changed must never be presented as one the pipeline derived. The model
 * value is kept beside the replacement rather than discarded — an override that
 * erases what it overrode is not an audit trail.
 */

export interface Overridden<T> {
    value: T
    origin: "model" | "person"
    /** Present only when origin is "person". */
    override?: {
        previousValue: unknown
        rationale: string
        author: string
        at: string
    }
}

/** A fact or conflict field, or "category:Financial Readiness" for a score. */
type TargetKey = string

export interface MergedAnalysis {
    analysis: unknown
    /**
     * Every value a person changed, keyed by target. Null when nothing has been
     * overridden — distinct from an empty object, which would say a merge ran
     * and found nothing.
     */
    overrides: Record<TargetKey, Overridden<unknown>> | null
    /** Notes attached to the run that change no value. */
    annotations: {
        targetKey: string
        rationale: string
        author: string
        at: string
    }[]
}

const keyOf = (row: AnalysisOverrideRecord) =>
    `${row.targetType}:${row.targetKey}`

/**
 * Reads the model's own value for a target so the override can carry what it
 * replaced. Returns undefined when the shape does not hold it — a target may
 * name something the analysis no longer contains, and inventing a previous
 * value would be worse than admitting there isn't one.
 */
function modelValueAt(analysis: unknown, row: AnalysisOverrideRecord): unknown {
    if (!analysis || typeof analysis !== "object") return undefined
    const root = analysis as Record<string, unknown>

    if (row.targetType === "SCORECARD") {
        const category = row.targetKey.replace(/^category:/, "")
        const onePager = root.one_pager as Record<string, unknown> | undefined
        const scorecard = onePager?.scorecard
        if (!Array.isArray(scorecard)) return undefined
        return scorecard.find(
            (entry) =>
                (entry as Record<string, unknown>)?.category === category,
        )
    }

    if (row.targetType === "CONFLICT") {
        const conflicts = root.conflicts
        if (!Array.isArray(conflicts)) return undefined
        return conflicts.find(
            (c) => (c as Record<string, unknown>)?.field === row.targetKey,
        )
    }

    // FACT
    const facts = root.facts as Record<string, unknown> | undefined
    return facts?.[row.targetKey]
}

export function mergeOverrides(
    analysis: unknown,
    effective: AnalysisOverrideRecord[],
    annotations: AnalysisOverrideRecord[],
): MergedAnalysis {
    const overrides: Record<TargetKey, Overridden<unknown>> = {}

    for (const row of effective) {
        overrides[keyOf(row)] = {
            value: row.value,
            origin: "person",
            override: {
                previousValue: modelValueAt(analysis, row),
                rationale: row.rationale,
                author: row.authorId,
                at:
                    row.createdAt instanceof Date
                        ? row.createdAt.toISOString()
                        : String(row.createdAt),
            },
        }
    }

    return {
        analysis,
        overrides: Object.keys(overrides).length > 0 ? overrides : null,
        annotations: annotations.map((row) => ({
            targetKey: row.targetKey,
            rationale: row.rationale,
            author: row.authorId,
            at:
                row.createdAt instanceof Date
                    ? row.createdAt.toISOString()
                    : String(row.createdAt),
        })),
    }
}
