"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { AutomationRepositoryImpl } from "@/data/automations/automationRepositoryImpl"
import { AutomationStatus } from "@/domain/automations/models/automation"
import { DownloadReportUseCase } from "@/domain/automations/usecases/downloadReport"
import { useRun } from "@/presentation/run/runContext"

/**
 * The four domain reports, each with its own state and its own button.
 *
 * They used to share a single `downloadingReport` boolean, so pressing one put
 * all four into a spinner, and a failure was reported into a toast portal that
 * was never mounted.
 */
export default function ReportsPage() {
  const { company, state } = useRun()
  const [busy, setBusy] = useState<string | null>(null)

  if (state.domains.length === 0) {
    return (
      <div className="rounded-md border border-border p-5">
        <h2 className="text-sm font-semibold">No domain reports yet</h2>
        <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
          Once the dataroom has been read, four reports can be written from the
          same evidence: operational, commercial, financial, and cap table and
          legal. Start them from the memorandum page.
        </p>
      </div>
    )
  }

  const download = async (automationId: string, label: string) => {
    setBusy(automationId)
    try {
      const useCase = new DownloadReportUseCase(new AutomationRepositoryImpl())
      const fileName = `report_${label}_${company?.name ?? "company"}.pdf`.replace(
        /[^a-zA-Z0-9._-]/g,
        "_",
      )
      await useCase.execute(automationId, fileName)
      toast.success(`${label} report downloaded`)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "The download did not complete",
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col pb-16">
      {state.domains.map((d) => (
        <div
          key={d.stage}
          className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 py-4"
        >
          <div>
            <h2 className="text-sm font-medium">{d.label}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {d.status === AutomationStatus.COMPLETED
                ? "Ready"
                : d.status === AutomationStatus.FAILED
                  ? (d.failureReason ?? "Failed without a recorded reason")
                  : "Writing…"}
            </p>
          </div>
          {d.status === AutomationStatus.COMPLETED && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => download(d.automation.id, d.label)}
              disabled={busy === d.automation.id}
            >
              {busy === d.automation.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              PDF
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}
