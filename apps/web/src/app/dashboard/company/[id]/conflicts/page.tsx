"use client"

import { use, useEffect, useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { AutomationStage, AutomationStatus } from "@/domain/automations/models/automation"
import type { Company } from "@/domain/companies/models/company"
import { ConflictsView } from "@/presentation/conflicts/conflictsView"

/**
 * The contradictions in one run, at an address you can paste into a document.
 *
 * If disagreement between documents is what this product is for, it deserves a
 * URL rather than a section someone has to scroll to.
 */
export default function ConflictsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [company, setCompany] = useState<Company | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/company/${id}`)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load this company.")
        return response.json()
      })
      .then((data: Company) => !cancelled && setCompany(data))
      .catch((cause: Error) => !cancelled && setError(cause.message))
    return () => {
      cancelled = true
    }
  }, [id])

  if (error) {
    return (
      <p className="mx-auto max-w-4xl px-6 py-8 text-sm text-destructive">
        {error}
      </p>
    )
  }

  if (!company) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-6 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const triage = company.automations?.find(
    (automation) =>
      automation.stage === AutomationStage.TRIAGE &&
      automation.status === AutomationStatus.COMPLETED,
  )

  if (!triage) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl">Contradictions</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {company.name} has no completed analysis yet. Documents are compared
          against each other once triage finishes.
        </p>
      </div>
    )
  }

  return (
    <ConflictsView
      companyId={id}
      triageAutomationId={triage.id}
      companyName={company.name}
    />
  )
}
