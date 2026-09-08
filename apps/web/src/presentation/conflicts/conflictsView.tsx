"use client"

import { CheckCircle2 } from "lucide-react"

import type { Analysis } from "@/domain/analysis/models/analysis"
import {
  buildConflictCases,
  corroboratedFields,
} from "@/domain/analysis/usecases/conflicts"
import {
  summariseVerification,
  type VerificationSummary,
} from "@/domain/analysis/usecases/verification"
import { ConflictCase } from "./conflictCase"

/**
 * What was checked across the whole dataroom, not just the contested figures.
 *
 * Most facts never conflict, so everything below this line describes a
 * minority of the evidence. Without a total, a page showing two verified
 * quotes reads as a verified dataroom.
 *
 * The unchecked count is stated even at zero. It is the number that says
 * whether any of this rests on a document nobody could read, and a figure that
 * only appears when it is bad teaches a reader that its absence means nothing.
 */
function VerificationLine({ summary }: { summary: VerificationSummary }) {
  if (summary.total === 0) return null

  return (
    <p className="mb-6 rounded-md border border-border bg-muted/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
      <span data-numeric>{summary.verified}</span> of{" "}
      <span data-numeric>{summary.quoted}</span> quoted facts were found in the
      document they cite.{" "}
      {summary.notFound > 0 && (
        <>
          <span className="text-conflict" data-numeric>
            {summary.notFound}
          </span>{" "}
          were not.{" "}
        </>
      )}
      <span data-numeric>{summary.unchecked}</span>{" "}
      {summary.unchecked === 1 ? "was" : "were"} unverifiable — no source text
      to check against.{" "}
      {summary.unquoted > 0 && (
        <>
          <span data-numeric>{summary.unquoted}</span>{" "}
          {summary.unquoted === 1 ? "fact" : "facts"} came back without a quote
          and could not be checked at all.
        </>
      )}
    </p>
  )
}

interface Props {
  /** Already loaded by the run layout — one fetch feeds every screen. */
  analysis: Analysis
}

export function ConflictsView({ analysis }: Props) {
  const cases = buildConflictCases(analysis)
  const corroborated = corroboratedFields(analysis)
  const verification = summariseVerification(analysis)
  const suppressed = analysis.suppressed_conflicts ?? []

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl">Contradictions</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Where the documents in this dataroom state the same thing differently.
          Each figure is shown on its own terms, with the passage it came from,
          and the rule that decided which one the memorandum uses.
        </p>
      </header>


      <VerificationLine summary={verification} />

      {cases.length === 0 && (
        // A result, not an absence. "No contradictions found" on its own reads
        // as "we did not look".
        <div className="rounded-md border border-border bg-card p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-sm">No contradictions found.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {corroborated.length > 0 ? (
                  <>
                    <span data-numeric>{corroborated.length}</span>{" "}
                    {corroborated.length === 1 ? "field was" : "fields were"}{" "}
                    stated by more than one document and matched.
                  </>
                ) : (
                  <>
                    No field in this dataroom was stated by more than one
                    document, so there was nothing to cross-check.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {cases.length > 0 && (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            <span data-numeric>{cases.length}</span>{" "}
            {cases.length === 1 ? "contradiction" : "contradictions"}
            {cases.some((c) => !c.resolved) && (
              <>
                {", "}
                <span className="text-conflict" data-numeric>
                  {cases.filter((c) => !c.resolved).length}
                </span>{" "}
                unresolved
              </>
            )}
          </p>
          <div className="space-y-6">
            {cases.map((conflictCase) => (
              <ConflictCase
                key={conflictCase.field}
                conflictCase={conflictCase}
              />
            ))}
          </div>
        </>
      )}

      {/*
        Raised and then dismissed. The merge flags a disagreement
        deterministically and a model gets one say — is this the same figure
        written two ways? When it says yes the conflict disappears, and that
        used to leave no trace outside the agent's logs. A dataroom where
        nothing disagreed is not the same as one where a disagreement was waved
        away, and only the reader can judge whether the reason holds.
      */}
      {suppressed.length > 0 && (
        <section className="mt-10 border-t border-border pt-6">
          <h2 className="text-sm font-medium">
            Raised, then dismissed{" "}
            <span className="text-muted-foreground" data-numeric>
              ({suppressed.length})
            </span>
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Flagged as a disagreement by the merge, then judged to be the same
            figure written differently. The reason given is shown so you can
            disagree with it.
          </p>
          <ul className="mt-4 space-y-3">
            {suppressed.map(({ conflict, reason }) => (
              <li
                key={conflict.field}
                className="rounded-md border border-border bg-muted/20 p-3"
              >
                <p className="font-mono text-xs">{conflict.field}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {conflict.values.join("  ·  ")}
                </p>
                <p className="mt-2 text-xs leading-relaxed">{reason}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
