import type { OnePager, ScorecardCategory } from "../models/analysis"

/**
 * The scorecard's arithmetic, reproduced so the UI can show its working.
 *
 * A score is a model, not a statement. Showing the weights and the coverage
 * denominator is what lets a sceptic check whether the headline was
 * weight-gamed, which is the first thing a sceptic will want to do.
 *
 * If this drifts from the backend's arithmetic the app lies in the most
 * damaging way available to it — confidently, with a number.
 */

/** Below this, the backend refuses to publish an overall score at all. */
export const MIN_COVERAGE_TO_PUBLISH = 0.75

export interface ScorecardRow {
  category: string
  /** 0–5. */
  score: number
  /** Share of the rubric, derived — never hardcoded from the Python constant. */
  weight: number
  /** score × weight, as the backend computed it. */
  weighted: number
  /** The most this category could contribute: 5 × weight. */
  ceiling: number
  keyIssues: string[]
}

export interface ScorecardModel {
  rows: ScorecardRow[]
  /** Σ weighted. */
  total: number
  /** Fraction of the rubric actually scored. */
  coverage: number
  /** total ÷ coverage, or null when coverage is too low to publish. */
  overall: number | null
  /** What the backend published, verbatim, e.g. "3.0/5.0". */
  publishedOverall: string
  /** True when coverage is below the publishing floor. */
  suppressed: boolean
}

/** "2.5/5" -> 2.5; "3.0" -> 3.0; anything unreadable -> 0. */
export function parseScore(raw: string): number {
  const value = Number.parseFloat(String(raw ?? "").split("/")[0])
  return Number.isFinite(value) ? value : 0
}

export function buildScorecard(onePager: OnePager): ScorecardModel {
  const rows = (onePager.scorecard ?? []).map(toRow)
  const total = rows.reduce((sum, row) => sum + row.weighted, 0)

  const coverage = parseCoverage(onePager.scorecard_coverage)
  const suppressed = coverage < MIN_COVERAGE_TO_PUBLISH
  const overall = suppressed || coverage === 0 ? null : total / coverage

  return {
    rows,
    total: round(total),
    coverage,
    overall: overall === null ? null : round(overall),
    publishedOverall: onePager.overall_score ?? "",
    suppressed,
  }
}

function toRow(category: ScorecardCategory): ScorecardRow {
  const score = parseScore(category.score)
  const weighted = Number.parseFloat(category.weighted_score) || 0
  // Derived, not read from a table. The backend owns CATEGORY_WEIGHTS; copying
  // it into TypeScript would go stale the first time the rubric is retuned,
  // and the UI would misreport the weighting while looking authoritative.
  const weight = score > 0 ? weighted / score : 0

  return {
    category: category.category,
    score,
    weight: round(weight, 4),
    weighted: round(weighted),
    ceiling: round(5 * weight),
    keyIssues: category.key_issues ?? [],
  }
}

/**
 * Recomputes the overall under weights the reader chose, renormalised to sum to
 * one so the result stays on the same 0–5 scale as the published figure.
 *
 * Local to the browser and never sent anywhere. Its only job is to answer "is
 * this score an artefact of how it was weighted?"
 */
export function applyWeights(
  rows: ScorecardRow[],
  weights: Record<string, number>,
): number | null {
  const total = rows.reduce((sum, row) => sum + (weights[row.category] ?? 0), 0)
  if (total <= 0) return null
  return round(
    rows.reduce(
      (sum, row) => sum + row.score * ((weights[row.category] ?? 0) / total),
      0,
    ),
  )
}

function parseCoverage(raw: string | undefined): number {
  const value = Number.parseFloat(raw ?? "")
  // Absent means the whole rubric was scored. Defaulting to 0 would suppress
  // the headline on every run written before the field existed.
  return Number.isFinite(value) ? value : 1
}

function round(value: number, places = 2): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}
