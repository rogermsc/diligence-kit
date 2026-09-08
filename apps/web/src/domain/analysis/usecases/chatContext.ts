import type { Analysis } from "../models/analysis"

/**
 * What the assistant needs to answer "why that number?".
 *
 * The chat widget carried a company id and a name, and the agent behind it
 * reads platform logs — so it could say why your job crashed and could not say
 * why the pipeline chose £3.2M over £4.1M. The answer was already on the same
 * screen, in the payload the run had loaded.
 *
 * Adjudicated decisions only: the value a stated rule chose, the rule, and the
 * values it rejected. Not the model's prose, which is the thing a reader would
 * be asking about rather than the thing that settles it. Capped, because a
 * large dataroom would otherwise put thousands of facts into every message.
 */

const MAX_FACTS = 40

export interface ChatContext {
  company: string
  decided: {
    field: string
    used: string
    because: string
    rejected: string[]
  }[]
  unresolved: { field: string; values: string[] }[]
  headline: { field: string; value: string; source: string; page: string }[]
  coverage: { covered: number; missing: string[] }
}

export function buildChatContext(
  companyName: string,
  analysis: Analysis,
): ChatContext {
  const decided = analysis.conflicts
    .filter((c) => c.preferred_value)
    .map((c) => ({
      field: c.field,
      used: c.preferred_value,
      because: `${c.resolution_basis}: ${c.rationale}`,
      rejected: c.values.filter((v) => !v.startsWith(c.preferred_value)),
    }))

  const unresolved = analysis.conflicts
    .filter((c) => !c.preferred_value)
    .map((c) => ({ field: c.field, values: c.values }))

  const headline = Object.entries(analysis.facts)
    .flatMap(([field, facts]) =>
      facts.map((f) => ({
        field,
        value: f.value,
        source: f.source,
        page: f.page,
      })),
    )
    .slice(0, MAX_FACTS)

  return {
    company: companyName,
    decided,
    unresolved,
    headline,
    coverage: {
      covered: Object.keys(analysis.coverage).length,
      missing: analysis.missing,
    },
  }
}
