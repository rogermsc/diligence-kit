import { resolveEffective } from "./list-overrides.usecase"
import { AnalysisOverrideRecord } from "../domain/repository/override-repository.interface"

/**
 * The table is append-only, so "what is in force" is a fold over history rather
 * than a row you can read. Getting this wrong is the worst failure available to
 * this feature: a withdrawn override still applied, or a decision silently lost.
 */

let clock = 0
function row(
    partial: Partial<AnalysisOverrideRecord> & { targetKey: string },
): AnalysisOverrideRecord {
    return {
        id: `id-${clock}`,
        automationId: "a1",
        targetType: "FACT",
        value: { v: "x" },
        rationale: "because the audited accounts say otherwise",
        authorId: "u1",
        createdAt: new Date(2026, 0, 1, 0, 0, clock++),
        ...partial,
    }
}

beforeEach(() => {
    clock = 0
})

describe("resolveEffective", () => {
    it("returns nothing for a run nobody has touched", () => {
        expect(resolveEffective([])).toEqual([])
    })

    it("keeps the latest decision per target", () => {
        const effective = resolveEffective([
            row({ targetKey: "annual_revenue_fy2024", value: { v: "£3.8M" } }),
            row({ targetKey: "annual_revenue_fy2024", value: { v: "£3.2M" } }),
        ])

        expect(effective).toHaveLength(1)
        expect(effective[0].value).toEqual({ v: "£3.2M" })
    })

    it("treats a valueless row as a withdrawal, not as a decision", () => {
        const effective = resolveEffective([
            row({ targetKey: "annual_revenue_fy2024", value: { v: "£3.2M" } }),
            row({ targetKey: "annual_revenue_fy2024", value: null }),
        ])

        expect(effective).toEqual([])
    })

    it("lets a target be overridden again after being withdrawn", () => {
        const effective = resolveEffective([
            row({ targetKey: "ebitda", value: { v: "a" } }),
            row({ targetKey: "ebitda", value: null }),
            row({ targetKey: "ebitda", value: { v: "b" } }),
        ])

        expect(effective).toHaveLength(1)
        expect(effective[0].value).toEqual({ v: "b" })
    })

    it("does not let one target's withdrawal cancel another's", () => {
        const effective = resolveEffective([
            row({ targetKey: "ebitda", value: { v: "kept" } }),
            row({ targetKey: "employees", value: null }),
        ])

        expect(effective.map((r) => r.targetKey)).toEqual(["ebitda"])
    })

    it("keys on type as well as name, so a fact and a scorecard entry can share one", () => {
        const effective = resolveEffective([
            row({ targetType: "FACT", targetKey: "ebitda", value: { v: "f" } }),
            row({
                targetType: "SCORECARD",
                targetKey: "ebitda",
                value: { v: "s" },
            }),
        ])

        expect(effective).toHaveLength(2)
    })

    it("ignores annotations rather than reporting them as withdrawals", () => {
        // An annotation carries no value by design. Folding it in would both
        // drop the note and, worse, read as a withdrawal of the override on the
        // same target.
        const effective = resolveEffective([
            row({ targetKey: "ebitda", value: { v: "kept" } }),
            row({ targetType: "ANNOTATION", targetKey: "ebitda", value: null }),
        ])

        expect(effective).toHaveLength(1)
        expect(effective[0].value).toEqual({ v: "kept" })
    })
})
