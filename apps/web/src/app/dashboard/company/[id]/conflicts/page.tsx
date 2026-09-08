"use client"

import { ConflictsView } from "@/presentation/conflicts/conflictsView"
import { useRun } from "@/presentation/run/runContext"
import { useRunGate } from "@/presentation/run/runStates"

/**
 * The contradictions in one run, at an address you can paste into a document.
 *
 * If disagreement between documents is what this product is for, it deserves a
 * URL rather than a section someone has to scroll to. It now sits alongside the
 * memorandum and the evidence it draws on, under one header, instead of behind
 * a grey button in a sidebar card.
 */
export default function ConflictsPage() {
  const gate = useRunGate()
  const { analysis } = useRun()
  return (
    <div className="pb-16">
      {gate ?? <ConflictsView analysis={analysis!} />}
    </div>
  )
}
