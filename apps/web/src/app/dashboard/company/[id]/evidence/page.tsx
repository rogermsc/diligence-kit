"use client"

import { EvidenceView } from "@/presentation/evidence/evidenceView"
import { useRun } from "@/presentation/run/runContext"
import { useRunGate } from "@/presentation/run/runStates"

export default function EvidencePage() {
  const gate = useRunGate()
  const { analysis } = useRun()
  return (
    <div className="pb-16">{gate ?? <EvidenceView analysis={analysis!} />}</div>
  )
}
