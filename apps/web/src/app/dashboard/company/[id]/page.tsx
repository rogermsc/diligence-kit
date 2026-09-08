"use client"

import { MemorandumView } from "@/presentation/memorandum/memorandumView"
import { ScorecardView } from "@/presentation/scorecard/scorecardView"
import { useRun } from "@/presentation/run/runContext"
import { useRunGate } from "@/presentation/run/runStates"
import { RunActions } from "@/presentation/run/runActions"
import { AuditTrail } from "@/presentation/overrides/auditTrail"

/**
 * The memorandum, on screen, where it always should have been.
 *
 * This route used to render a wall of status cards and a Download button,
 * because the field it looked for to show the memo inline was one nothing
 * produced.
 */
export default function RunOverviewPage() {
  const gate = useRunGate()
  const { analysis } = useRun()

  return (
    <div className="flex flex-col gap-10 pb-16">
      <RunActions />
      {gate ?? (
        <>
          <ScorecardView onePager={analysis!.one_pager} />
          <AuditTrail />
          <MemorandumView onePager={analysis!.one_pager} />
        </>
      )}
    </div>
  )
}
