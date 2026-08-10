"use client"

import Link from "next/link"
import { AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useConflictsViewModel } from "./conflictsViewModel"
import { ConflictCase } from "./conflictCase"

interface Props {
  companyId: string
  triageAutomationId: string
  companyName?: string
}

export function ConflictsView({
  companyId,
  triageAutomationId,
  companyName,
}: Props) {
  const { loading, error, unavailable, cases, corroborated } =
    useConflictsViewModel(triageAutomationId)

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link
        href={`/dashboard/company/${companyId}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to {companyName ?? "company"}
      </Link>

      <header className="mb-8">
        <h1 className="text-2xl">Contradictions</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Where the documents in this dataroom state the same thing differently.
          Each figure is shown on its own terms, with the passage it came from,
          and the rule that decided which one the memorandum uses.
        </p>
      </header>

      {loading && (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-md border border-border bg-card p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="text-sm">{error}</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={`/dashboard/company/${companyId}`}>
                  Back to the run
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && unavailable && (
        // Not a failure. Runs that finished before the analysis was persisted
        // still have their memorandum; there is just nothing structured to show.
        <div className="rounded-md border border-dashed border-border p-6">
          <p className="text-sm">
            This run finished before the analysis was stored, so only the
            rendered memorandum is available.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Re-running it will produce the full evidence trail.
          </p>
        </div>
      )}

      {!loading && !error && !unavailable && cases.length === 0 && (
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

      {!loading && !error && cases.length > 0 && (
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
    </div>
  )
}
