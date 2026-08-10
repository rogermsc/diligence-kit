import type { Analysis, Conflict, Fact, SourceType } from "../models/analysis"

/**
 * Turning a conflict into something you can render beside its evidence.
 *
 * `Conflict.values` arrives preformatted — "£3.8M (02_financial_model.xlsx
 * (Summary) Summary type=pro_forma)" — and carries no quote. Parsing it back
 * apart is a trap: the source name has its own parentheses, so neither the
 * first nor the last " (" reliably ends the value, and a value can be
 * parenthesised too ("(£0.31M) FY2024").
 *
 * So we do not parse it. `merged.facts[field]` holds the same facts the backend
 * deduplicated to build that list, in the same order and by the same rule
 * (first occurrence of each normalised value wins — see fact_merge.py). Redoing
 * that fold here recovers source, page, date, basis *and the quote*, all
 * structured, with no string surgery at all.
 */

export interface ConflictValue {
  value: string
  source: string
  page: string
  quote: string
  sourceType: SourceType
  documentDate: string
  documentVersion: string
  /** True for the value the backend's rules selected. */
  preferred: boolean
  /** Whether the quote was found in the source. Null means it could not be checked. */
  quoteVerified: boolean | null
}

export interface ConflictCase {
  field: string
  values: ConflictValue[]
  resolved: boolean
  preferredValue: string
  preferredSource: string
  /** "source_type" | "document_authority" | "recency" | "unresolved" */
  basis: string
  rationale: string
  confidence: number
  /** e.g. "28% spread, £3.2M to £4.1M". Empty when the values would not parse. */
  magnitude: string
}

const normalise = (value: string) => value.trim().toLowerCase()

/**
 * The same dedupe fact_merge applies before it writes `Conflict.values`, so the
 * two lists line up index for index.
 */
export function distinctFacts(facts: Fact[]): Fact[] {
  const seen = new Set<string>()
  const out: Fact[] = []
  for (const fact of facts) {
    const key = normalise(fact.value)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(fact)
  }
  return out
}

export function buildConflictCase(
  conflict: Conflict,
  factsForField: Fact[],
): ConflictCase {
  const distinct = distinctFacts(factsForField ?? [])

  const values: ConflictValue[] = distinct.map((fact) => ({
    value: fact.value,
    source: fact.source,
    page: fact.page,
    quote: fact.quote,
    sourceType: fact.source_type,
    documentDate: fact.document_date,
    documentVersion: fact.document_version,
    quoteVerified: fact.quote_verified,
    preferred:
      conflict.preferred_value !== "" &&
      normalise(fact.value) === normalise(conflict.preferred_value),
  }))

  return {
    field: conflict.field,
    values,
    // Driven by preferred_value, not by basis: a case can only claim to be
    // resolved if there is a value to point at.
    resolved: conflict.preferred_value !== "",
    preferredValue: conflict.preferred_value,
    preferredSource: conflict.preferred_source,
    basis: conflict.resolution_basis || "unresolved",
    rationale: conflict.rationale,
    confidence: conflict.confidence,
    magnitude: conflict.magnitude,
  }
}

export function buildConflictCases(analysis: Analysis): ConflictCase[] {
  return analysis.conflicts.map((conflict) =>
    buildConflictCase(conflict, analysis.facts[conflict.field] ?? []),
  )
}

/**
 * Fields more than one document stated, and agreed on.
 *
 * The empty state has to be a result, not an absence. "No contradictions
 * found" on its own reads as "we did not look"; naming how many fields were
 * corroborated says the check ran.
 */
export function corroboratedFields(analysis: Analysis): string[] {
  const conflicted = new Set(analysis.conflicts.map((c) => c.field))
  return Object.entries(analysis.facts)
    .filter(([field, facts]) => {
      if (conflicted.has(field)) return false
      const sources = new Set(facts.map((f) => f.source))
      return sources.size > 1 && distinctFacts(facts).length === 1
    })
    .map(([field]) => field)
}
