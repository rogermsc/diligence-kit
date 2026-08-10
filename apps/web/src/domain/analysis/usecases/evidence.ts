import type { Analysis, Fact } from "../models/analysis"
import { distinctFacts } from "./conflicts"

/**
 * The facts table: one row per field-and-value, carrying every source that
 * states it.
 *
 * Two facts with the same value from two documents are corroboration and
 * belong on one row; two facts with different values are a disagreement and
 * must stay on separate ones. Collapsing on the field alone would hide the
 * conflict — which is the only thing this product must never do.
 */

export interface EvidenceRow {
  field: string
  value: string
  /** Every fact stating this value, one per document. */
  facts: Fact[]
  /** True when more than one document states it. */
  corroborated: boolean
  /** True when this field is stated more than one way anywhere. */
  contested: boolean
}

export interface EvidenceIndex {
  rows: EvidenceRow[]
  /** Documents that produced at least one fact, with their counts. */
  sources: { source: string; facts: number }[]
  /** Information types no document covered. */
  missing: string[]
  coveredCount: number
  totalTypes: number
}

const normalise = (value: string) => value.trim().toLowerCase()

export function buildEvidenceIndex(analysis: Analysis): EvidenceIndex {
  const rows: EvidenceRow[] = []
  const factsPerSource = new Map<string, number>()

  for (const [field, facts] of Object.entries(analysis.facts)) {
    const contested = distinctFacts(facts).length > 1

    const byValue = new Map<string, Fact[]>()
    for (const fact of facts) {
      const key = normalise(fact.value)
      const bucket = byValue.get(key)
      if (bucket) bucket.push(fact)
      else byValue.set(key, [fact])
      factsPerSource.set(fact.source, (factsPerSource.get(fact.source) ?? 0) + 1)
    }

    for (const group of byValue.values()) {
      rows.push({
        field,
        value: group[0].value,
        facts: group,
        // Distinct documents, not distinct facts. One document stating the same
        // thing on two pages is not a second opinion.
        corroborated: new Set(group.map((f) => f.source)).size > 1,
        contested,
      })
    }
  }

  rows.sort((a, b) => a.field.localeCompare(b.field) || a.value.localeCompare(b.value))

  const coveredCount = Object.keys(analysis.coverage).length

  return {
    rows,
    sources: [...factsPerSource.entries()]
      .map(([source, facts]) => ({ source, facts }))
      .sort((a, b) => a.source.localeCompare(b.source)),
    missing: analysis.missing,
    coveredCount,
    totalTypes: coveredCount + analysis.missing.length,
  }
}

/**
 * Where in the quote the extracted value appears, or null if it does not.
 *
 * Only ever highlight a literal match. Highlighting a near-miss would assert a
 * provenance the document does not support, which is the failure this product
 * exists to prevent.
 */
export function locateValueInQuote(
  value: string,
  quote: string,
): { start: number; end: number } | null {
  if (!value || !quote) return null
  const start = quote.toLowerCase().indexOf(value.trim().toLowerCase())
  return start === -1 ? null : { start, end: start + value.trim().length }
}
