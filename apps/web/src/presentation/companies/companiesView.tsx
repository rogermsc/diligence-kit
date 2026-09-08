"use client"

import Link from "next/link"
import { AlertCircle, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CreateCompanyModal } from "@/components/create-company-modal"
import { phaseLabel, runState } from "@/domain/automations/usecases/runState"
import { cn } from "@/lib/utils"
import { useCompaniesViewModel } from "./companiesViewModel"

/**
 * Every company under diligence, and where each one has got to.
 *
 * A row used to carry the company's name and a status dot, and nothing else —
 * while the payload behind it held the whole run. It was also a div with a
 * pointer cursor rather than a link, so an analyst working five deals could not
 * open one in a new tab.
 */
export function CompaniesView() {
  const { companies, loading, error, refetch, createCompany } =
    useCompaniesViewModel()

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl">Companies</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each one holds a dataroom, the facts read out of it, and the figures
            its documents state differently.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateCompanyModal onCreateCompany={createCompany} />
          <Button onClick={refetch} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              {/* The server's own words. This used to be replaced by a fixed
                  sentence, so a rate limit and an outage read the same. */}
              <p className="font-mono text-xs leading-relaxed">{error}</p>
              <Button
                onClick={refetch}
                variant="outline"
                size="sm"
                className="mt-3"
              >
                Try again
              </Button>
            </div>
          </div>
        </div>
      )}

      {loading && companies.length === 0 && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}

      {!loading && !error && companies.length === 0 && (
        // The call to action sits inside the empty state, not 300px away in the
        // corner. A first-time user's first screen used to be a card telling
        // them nothing was there, with no way forward on it.
        <div className="rounded-md border border-dashed border-border p-8 text-center">
          <h2 className="text-sm font-semibold">No companies yet</h2>
          <p className="mx-auto mt-1 max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
            Add a company, then upload its dataroom. Every document is
            classified, read for facts with the passage that states each one,
            and checked against the others.
          </p>
          <div className="mt-5 flex justify-center">
            <CreateCompanyModal onCreateCompany={createCompany} />
          </div>
        </div>
      )}

      {companies.length > 0 && (
        <ul className="flex flex-col">
          {companies.map((company) => {
            const state = runState(company.automations)
            return (
              <li key={company.id} className="border-b border-border/60">
                <Link
                  href={`/dashboard/company/${company.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3.5 transition-colors hover:bg-muted/40"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {company.name}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        state.phase === "triage_failed" ||
                          state.phase === "reports_partial"
                          ? "bg-destructive"
                          : state.active
                            ? "animate-pulse bg-primary"
                            : state.phase === "not_started"
                              ? "bg-missing"
                              : "bg-evidence-actual",
                      )}
                    />
                    {phaseLabel(state)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
