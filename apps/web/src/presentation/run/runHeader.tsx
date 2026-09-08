"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { AutomationStatus } from "@/domain/automations/models/automation"
import { phaseLabel } from "@/domain/automations/usecases/runState"
import { useRun } from "./runContext"

/**
 * Where you are, what this run says, and where else you can go.
 *
 * The application's entire navigation used to be a logo, a logout button and a
 * theme toggle, and the product's differentiator was a grey outline button in a
 * sidebar card with no count on it. Three screens showed parts of one run and
 * nothing tied them together.
 *
 * The counts are the point of putting them here. "Contradictions" tells a
 * reader nothing about whether to click; "Contradictions 3" does, and a run
 * where two documents disagree three times is the case this product exists to
 * make.
 */

function Count({ value, tone }: { value: number; tone?: "conflict" }) {
  return (
    <span
      className={cn(
        "ml-1.5 rounded-sm px-1.5 py-0.5 font-mono text-[0.7rem] leading-none",
        tone === "conflict"
          ? "bg-conflict-bg text-conflict"
          : "bg-muted text-muted-foreground",
      )}
      data-numeric
    >
      {value}
    </span>
  )
}

export function RunHeader() {
  const pathname = usePathname()
  const {
    companyId,
    company,
    state,
    conflictCount,
    unresolvedCount,
    factCount,
    verifiedCount,
    analysis,
  } = useRun()

  const base = `/dashboard/company/${companyId}`
  const tabs = [
    { href: base, label: "Memorandum", exact: true },
    {
      href: `${base}/evidence`,
      label: "Evidence",
      count: factCount || undefined,
    },
    {
      href: `${base}/conflicts`,
      label: "Contradictions",
      count: analysis ? conflictCount : undefined,
      tone: unresolvedCount > 0 ? ("conflict" as const) : undefined,
    },
    { href: `${base}/reports`, label: "Reports" },
  ]

  const running = state.active

  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-border pb-4">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1 text-xs text-muted-foreground"
      >
        <Link href="/dashboard" className="hover:text-foreground">
          Companies
        </Link>
        <ChevronRight className="h-3 w-3" aria-hidden />
        <span className="text-foreground">{company?.name ?? "Loading…"}</span>
      </nav>

      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="text-2xl">{company?.name ?? " "}</h1>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                state.phase === "triage_failed" ||
                  state.phase === "reports_partial"
                  ? "bg-destructive"
                  : running
                    ? "animate-pulse bg-primary"
                    : "bg-evidence-actual",
              )}
            />
            {phaseLabel(state)}
          </span>
          {factCount > 0 && (
            <span>
              <span data-numeric>{verifiedCount}</span> of{" "}
              <span data-numeric>{factCount}</span> facts verified against their
              source
            </span>
          )}
        </div>
      </div>

      {/*
        The reason the backend recorded, not the word FAILED. Every failure used
        to collapse to that word, so a crashed agent and a four-hour timeout
        read identically and neither told anyone what to do next.
      */}
      {state.failureReason && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 font-mono text-xs leading-relaxed text-destructive">
          {state.failureReason}
        </p>
      )}

      <div className="flex flex-wrap gap-x-1 gap-y-1">
        {tabs.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-[1px] border-b-2 px-3 py-2 text-sm transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <Count value={tab.count} tone={tab.tone} />
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

/** The four domain runs, named and individually stateful. */
export function DomainProgress() {
  const { state } = useRun()
  if (state.domains.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-2">
      {state.domains.map((d) => (
        <li
          key={d.stage}
          className={cn(
            "rounded-sm border px-2.5 py-1 text-xs",
            d.status === AutomationStatus.COMPLETED &&
              "border-evidence-actual/40 bg-evidence-actual-bg text-evidence-actual",
            d.status === AutomationStatus.FAILED &&
              "border-destructive/40 text-destructive",
            d.status !== AutomationStatus.COMPLETED &&
              d.status !== AutomationStatus.FAILED &&
              "border-border text-muted-foreground",
          )}
          title={d.failureReason ?? undefined}
        >
          {d.label}
        </li>
      ))}
    </ul>
  )
}
