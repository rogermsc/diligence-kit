import type { Analysis, Fact } from "../models/analysis"

/**
 * How much of this dataroom was actually checked against its own documents.
 *
 * `quote_verified` has three states and the screen had two: a warning on
 * `false`, and nothing at all for `true` and `null` alike. So a fact nobody
 * could check — a scan with no text layer, or a re-run carrying only a file id
 * — rendered exactly like one checked and found. The agent goes to some
 * trouble to keep those apart (`grounding.verify` returns `None`, never
 * `False`, when there is no source text); collapsing them here throws that
 * away at the last inch, and in the direction that flatters the result.
 *
 * Counted over every fact, not just the contested ones. Most facts never
 * conflict, so the conflicts screen showed verification for a minority of the
 * evidence and stayed silent about the rest.
 */
export interface VerificationSummary {
  /** Facts that came back with a quote at all. */
  quoted: number
  /** …of which: found in the source text. */
  verified: number
  /** …of which: checked, and the quote was not there. */
  notFound: number
  /** …of which: no source text existed to check against. */
  unchecked: number
  /** Facts the model returned with no quote — nothing to check. */
  unquoted: number
  total: number
}

const isQuoted = (fact: Fact) => fact.grounding !== "unquoted" && fact.quote !== ""

export function summariseVerification(analysis: Analysis): VerificationSummary {
  const all = Object.values(analysis.facts).flat()
  const quoted = all.filter(isQuoted)

  return {
    total: all.length,
    quoted: quoted.length,
    verified: quoted.filter((f) => f.quote_verified === true).length,
    notFound: quoted.filter((f) => f.quote_verified === false).length,
    // Not `!== true`: a fact with no quote is already counted as unquoted, and
    // rolling it in here would report it as unverifiable, which it is not.
    unchecked: quoted.filter((f) => f.quote_verified === null).length,
    unquoted: all.length - quoted.length,
  }
}

/**
 * What to say about one fact's check, for each of the three states.
 *
 * A pure function rather than three branches inside the component, so the
 * property that matters — that `null` gets its own answer and never borrows
 * `true`'s silence or `false`'s accusation — is testable without a DOM.
 */
export function verificationNote(
  verified: boolean | null,
): { text: string; tone: "neutral" | "conflict" } {
  if (verified === true) {
    return { text: "found in the source document", tone: "neutral" }
  }
  if (verified === false) {
    return { text: "not found in the source document", tone: "conflict" }
  }
  return {
    // True of both causes: a scan with no text layer, and a re-run that
    // carried only a file id. "No readable text in this document" would be a
    // false claim about the second.
    text: "could not be checked — no source text was available",
    tone: "neutral",
  }
}
