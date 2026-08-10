/**
 * The structured analysis, exactly as the agent produces it.
 *
 * Counterpart to `apps/agent/src/domain/analyze/entities.py`. snake_case
 * throughout because the payload is stored and served verbatim: converting it
 * at the boundary would mean a mapper to maintain in lockstep with the Python
 * models, for no benefit to anything in between.
 *
 * Not a shared package. There is exactly one TypeScript consumer of this shape
 * — the browser — and the service's Zod schema is a deliberately weaker,
 * different type serving a different purpose. Add `packages/*` to the workspace
 * the day a second app needs this.
 *
 * The guard against drift is at runtime, not here: the service pins
 * `version: 1` on the callback, so a shape change without a coordinated deploy
 * fails loudly instead of arriving as something this file misdescribes.
 */

export const ANALYSIS_VERSION = 1

/** Whether a figure is what happened, what is claimed, or what is hoped. */
export type SourceType = "actual" | "pro_forma" | "projection" | ""

/** How well a fact is tied back to the document it came from. */
export type Grounding = "quoted" | "quoted_unlocated" | "unquoted" | ""

export interface Fact {
  field: string
  value: string
  /** File name, including the sheet for a spreadsheet: "model.xlsx (Summary)". */
  source: string
  /** Page number, sheet name, or cell reference. */
  page: string
  /** Verbatim excerpt from the document. */
  quote: string
  source_type: SourceType
  document_version: string
  document_date: string
  grounding: Grounding
  /**
   * Whether the quote was found in the source text. `null` means there was
   * nothing to check against — a scan with no text layer, or a retry carrying
   * only a file id — which is not the same answer as `false`.
   */
  quote_verified: boolean | null
}

/** How a disagreement between documents was settled, and on what grounds. */
export type ResolutionBasis =
  | "source_type"
  | "document_authority"
  | "recency"
  | "unresolved"
  | ""

export interface Conflict {
  field: string
  /** Preformatted "value (source page type=…)" strings, one per distinct value. */
  values: string[]
  /** Empty when `resolution_basis` is "unresolved" — no rule separated them. */
  preferred_value: string
  preferred_source: string
  resolution_basis: ResolutionBasis
  /** One sentence naming the rule that decided it. */
  rationale: string
  /** 0–1, derived from which rule fired. Never a model's self-report. */
  confidence: number
  /** e.g. "28% spread, £3.2M to £4.1M". Empty when the values will not parse. */
  magnitude: string
}

export interface ScorecardCategory {
  category: string
  score: string
  weighted_score: string
  key_issues: string[]
}

export interface OnePager {
  executive_summary: string
  company_overview: Record<string, string>
  financial_highlights: Record<string, string>
  business_metrics: Record<string, string>
  scorecard: ScorecardCategory[]
  overall_score: string
  /** Fraction of the rubric actually scored; the overall is normalised over it. */
  scorecard_coverage: string
  transaction_structure: Record<string, string>
  deal_rationale: Record<string, string>
  key_terms: Record<string, string>
  critical_risk_factors: { risk: string; mitigation: string }[]
  key_success_factors: string[]
  summary_highlights: Record<string, string>
}

export interface Analysis {
  version: typeof ANALYSIS_VERSION
  /** Field name to every fact stating it, across all documents. */
  facts: Record<string, Fact[]>
  /** Information type to the documents covering it. */
  coverage: Record<string, string[]>
  /** Information types no document covered. Absent evidence is evidence. */
  missing: string[]
  conflicts: Conflict[]
  one_pager: OnePager
}

export interface AnalysisResponse {
  automationId: string
  onePagerUrl: string
  /** Null for runs that completed before the analysis was persisted. */
  analysis: Analysis | null
}
