"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useRun } from "./runContext"

/**
 * The shared answers for "there is nothing to show yet, and here is why".
 *
 * Loading, empty and error blocks used to be copy-pasted between screens and
 * had drifted: a spinner and a sentence on two of them, skeletons on a third, a
 * bare paragraph with no retry on a fourth. Worse, the company screen showed
 * "Company not found" for every failure, including ones that had nothing to do
 * with the company existing.
 */

export function RunLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

export function RunError({ message }: { message: string }) {
  const { reload } = useRun()
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-5">
      <h2 className="text-sm font-semibold text-destructive">
        This run could not be loaded
      </h2>
      <p className="mt-1 font-mono text-xs leading-relaxed text-muted-foreground">
        {message}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => reload()}
      >
        Try again
      </Button>
    </div>
  )
}

export function CompanyNotFound() {
  return (
    <div className="rounded-md border border-border p-5">
      <h2 className="text-sm font-semibold">No such company</h2>
      <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
        It may have been deleted, or it belongs to someone else. Companies are
        only visible to the account that created them.
      </p>
      <Button variant="outline" size="sm" className="mt-4" asChild>
        <Link href="/dashboard">Back to companies</Link>
      </Button>
    </div>
  )
}

/**
 * Guards every run screen, so each page can assume it has an analysis.
 *
 * Returns null when there is something to render, and a block to render when
 * there is not.
 */
export function useRunGate(): React.ReactNode | null {
  const { loading, error, company, analysis, analysisUnavailable, state } =
    useRun()

  if (loading && !company) return <RunLoading />
  if (error) return <RunError message={error} />
  if (!company) return <CompanyNotFound />

  if (state.phase === "not_started") {
    return (
      <div className="rounded-md border border-border p-5">
        <h2 className="text-sm font-semibold">No dataroom yet</h2>
        <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
          Upload the company&apos;s dataroom as a ZIP and every document is
          classified, read for facts, and checked against the others for figures
          they state differently.
        </p>
      </div>
    )
  }

  if (state.phase === "triage_running") {
    return (
      <div className="rounded-md border border-border p-5">
        <h2 className="text-sm font-semibold">Reading the dataroom</h2>
        <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
          Each document is classified, then read for facts with the passage that
          states each one. This page updates itself; you can close it and come
          back.
        </p>
      </div>
    )
  }

  if (state.phase === "triage_failed") {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-5">
        <h2 className="text-sm font-semibold text-destructive">
          The analysis failed
        </h2>
        <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
          {state.failureReason ??
            "The agent stopped without reporting a reason."}
        </p>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="rounded-md border border-border p-5">
        <h2 className="text-sm font-semibold">
          {analysisUnavailable
            ? "This run predates the stored analysis"
            : "No analysis to show"}
        </h2>
        <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
          {analysisUnavailable
            ? "It finished before the structured analysis was kept, so only the rendered documents remain. Run it again to get the evidence and contradictions on screen."
            : "The run completed without producing one."}
        </p>
      </div>
    )
  }

  return null
}
