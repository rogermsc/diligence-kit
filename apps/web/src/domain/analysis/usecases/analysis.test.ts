import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import type { Analysis, Fact } from "../models/analysis"
import { buildConflictCases, corroboratedFields, distinctFacts } from "./conflicts"
import { buildEvidenceIndex, locateValueInQuote } from "./evidence"
import { applyWeights, buildScorecard, parseScore } from "./scorecard"

/**
 * Fed by the real payload the agent produces, not a hand-written one.
 *
 * These three functions are the only non-trivial logic in the app, and all
 * three fail in the same expensive way: silently, with a number that looks
 * right. A fixture written to match the code would not catch that — this is
 * the file `make demo` actually seeds from.
 */
const FIXTURE = path.resolve(
  __dirname,
  "../../../../../agent/fixtures/demo-output",
)

const facts = JSON.parse(readFileSync(path.join(FIXTURE, "facts.json"), "utf8"))
const onePager = JSON.parse(
  readFileSync(path.join(FIXTURE, "one_pager.json"), "utf8"),
)
const analysis: Analysis = { version: 1, ...facts, one_pager: onePager }

function fact(partial: Partial<Fact> & { value: string }): Fact {
  return {
    field: "annual_revenue_fy2024",
    source: "a.pdf",
    page: "1",
    quote: partial.value,
    source_type: "",
    document_version: "",
    document_date: "",
    grounding: "quoted",
    quote_verified: true,
    ...partial,
  }
}

describe("the demo fixture is the shape we think it is", () => {
  it("carries the planted disagreement and a full scorecard", () => {
    expect(analysis.conflicts.length).toBeGreaterThan(0)
    expect(analysis.one_pager.scorecard).toHaveLength(8)
  })
})

describe("conflict cases", () => {
  const revenue = buildConflictCases(analysis).find(
    (c) => c.field === "annual_revenue_fy2024",
  )!

  it("recovers each competing value with its own source and quote", () => {
    // The join that replaces parsing Conflict.values. A source name with its
    // own parentheses — "02_financial_model.xlsx (Summary)" — breaks every
    // split-on-paren approach, which is why we refold the facts instead.
    expect(revenue.values).toHaveLength(3)
    expect(revenue.values.map((v) => v.value).sort()).toEqual([
      "£3.2M",
      "£3.8M",
      "£4.1M",
    ])
    for (const value of revenue.values) {
      expect(value.source).not.toBe("")
      expect(value.quote).not.toBe("")
    }
    expect(revenue.values.some((v) => v.source.includes("(Summary)"))).toBe(true)
  })

  it("marks exactly one value preferred, and it is the audited actual", () => {
    const preferred = revenue.values.filter((v) => v.preferred)
    expect(preferred).toHaveLength(1)
    expect(preferred[0].value).toBe("£3.2M")
    expect(preferred[0].sourceType).toBe("actual")
    expect(preferred[0].source).toContain("audited")
  })

  it("carries the rule that decided it, not just the answer", () => {
    expect(revenue.resolved).toBe(true)
    expect(revenue.basis).toBe("source_type")
    expect(revenue.confidence).toBe(1)
    expect(revenue.rationale).toContain("actual")
    expect(revenue.magnitude).toContain("28%")
  })

  it("reports unresolved rather than inventing a winner", () => {
    // The one unforgivable bug in this product would be showing a confident
    // winner where the backend declined to pick one.
    const [unresolved] = buildConflictCases({
      ...analysis,
      conflicts: [
        {
          field: "annual_revenue_fy2024",
          values: ["£7M (a.pdf 1)", "£9M (b.pdf 1)"],
          preferred_value: "",
          preferred_source: "",
          resolution_basis: "unresolved",
          rationale: "No rule separated these.",
          confidence: 0,
          magnitude: "",
        },
      ],
      facts: {
        annual_revenue_fy2024: [
          fact({ value: "£7M", source: "a.pdf" }),
          fact({ value: "£9M", source: "b.pdf" }),
        ],
      },
    })

    expect(unresolved.resolved).toBe(false)
    expect(unresolved.values.every((v) => !v.preferred)).toBe(true)
    expect(unresolved.confidence).toBe(0)
  })

  it("dedupes by value the same way the backend did", () => {
    const deduped = distinctFacts([
      fact({ value: "£3.2M", source: "a.pdf" }),
      fact({ value: " £3.2m ", source: "b.pdf" }),
      fact({ value: "£3.8M", source: "c.pdf" }),
    ])
    expect(deduped.map((f) => f.value)).toEqual(["£3.2M", "£3.8M"])
  })

  it("names the fields that were corroborated, for the empty state", () => {
    // "No contradictions found" alone reads as "we did not look".
    const agreed = corroboratedFields({
      ...analysis,
      conflicts: [],
      facts: {
        employees: [
          fact({ value: "52", source: "a.pdf", field: "employees" }),
          fact({ value: "52", source: "b.pdf", field: "employees" }),
        ],
        website: [fact({ value: "x.com", source: "a.pdf", field: "website" })],
      },
    })
    expect(agreed).toEqual(["employees"])
  })
})

describe("scorecard arithmetic", () => {
  const model = buildScorecard(analysis.one_pager)

  it("reproduces the published overall score exactly", () => {
    // If this drifts from the backend, the app lies confidently and with a
    // number, which is the worst failure available to it.
    expect(model.overall).toBeCloseTo(parseScore(model.publishedOverall), 1)
  })

  it("derives each weight instead of hardcoding the backend's table", () => {
    for (const row of model.rows) {
      expect(row.weight).toBeGreaterThan(0)
      expect(row.score * row.weight).toBeCloseTo(row.weighted, 2)
    }
    const totalWeight = model.rows.reduce((sum, r) => sum + r.weight, 0)
    expect(totalWeight).toBeCloseTo(1, 2)
  })

  it("shows a ceiling per category so the drag is visible", () => {
    const financial = model.rows.find((r) => r.category.includes("Financial"))!
    expect(financial.ceiling).toBeCloseTo(5 * financial.weight, 4)
    expect(financial.weighted).toBeLessThan(financial.ceiling)
  })

  it("treats an absent coverage figure as a fully scored rubric", () => {
    // Defaulting to zero would suppress the headline on every run written
    // before the field existed.
    const model = buildScorecard({
      ...analysis.one_pager,
      scorecard_coverage: undefined as unknown as string,
    })
    expect(model.coverage).toBe(1)
    expect(model.suppressed).toBe(false)
  })

  it("suppresses the overall below the publishing floor", () => {
    const model = buildScorecard({
      ...analysis.one_pager,
      scorecard_coverage: "0.5",
    })
    expect(model.suppressed).toBe(true)
    expect(model.overall).toBeNull()
  })

  it("renormalises what-if weights so the scale does not move", () => {
    const flat = Object.fromEntries(model.rows.map((r) => [r.category, 1]))
    const result = applyWeights(model.rows, flat)!
    const mean =
      model.rows.reduce((sum, r) => sum + r.score, 0) / model.rows.length
    expect(result).toBeCloseTo(mean, 2)
    expect(result).toBeLessThanOrEqual(5)
  })

  it("returns null rather than dividing by zero when every weight is cleared", () => {
    const zeroed = Object.fromEntries(model.rows.map((r) => [r.category, 0]))
    expect(applyWeights(model.rows, zeroed)).toBeNull()
  })
})

describe("evidence index", () => {
  const index = buildEvidenceIndex(analysis)

  it("keeps differing values on separate rows", () => {
    // Collapsing on the field alone would hide the disagreement, which is the
    // one thing this product must never do.
    const revenue = index.rows.filter(
      (r) => r.field === "annual_revenue_fy2024",
    )
    expect(revenue).toHaveLength(3)
    expect(revenue.every((r) => r.contested)).toBe(true)
  })

  it("collapses the same value from two documents into one corroborated row", () => {
    const [row] = buildEvidenceIndex({
      ...analysis,
      facts: {
        employees: [
          fact({ value: "52", source: "a.pdf", field: "employees" }),
          fact({ value: "52", source: "b.pdf", field: "employees" }),
        ],
      },
    }).rows
    expect(row.facts).toHaveLength(2)
    expect(row.corroborated).toBe(true)
    expect(row.contested).toBe(false)
  })

  it("does not call one document repeating itself corroboration", () => {
    const [row] = buildEvidenceIndex({
      ...analysis,
      facts: {
        employees: [
          fact({ value: "52", source: "a.pdf", page: "1", field: "employees" }),
          fact({ value: "52", source: "a.pdf", page: "7", field: "employees" }),
        ],
      },
    }).rows
    expect(row.facts).toHaveLength(2)
    expect(row.corroborated).toBe(false)
  })

  it("loses no fact and no source", () => {
    const inputFacts = Object.values(analysis.facts).flat()
    const kept = index.rows.reduce((sum, row) => sum + row.facts.length, 0)
    expect(kept).toBe(inputFacts.length)
    expect(index.sources.length).toBe(
      new Set(inputFacts.map((f) => f.source)).size,
    )
  })

  it("reports what the dataroom does not contain", () => {
    expect(index.missing.length).toBeGreaterThan(0)
    expect(index.coveredCount + index.missing.length).toBe(index.totalTypes)
  })
})

describe("quote highlighting", () => {
  it("locates a value that literally appears in its quote", () => {
    expect(locateValueInQuote("£3.2M", "Turnover £3.2M")).toEqual({
      start: 9,
      end: 14,
    })
  })

  it("refuses to highlight a value the quote does not contain", () => {
    // A near-miss highlight would assert a provenance the document does not
    // support.
    expect(locateValueInQuote("£3.2M", "Revenue was 3.2 million")).toBeNull()
  })
})
