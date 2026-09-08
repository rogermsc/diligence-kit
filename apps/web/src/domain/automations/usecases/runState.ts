import {
  Automation,
  AutomationStage,
  AutomationStatus,
} from "../models/automation"

/**
 * Where a company's analysis has actually got to.
 *
 * The screen used to read this off a single `status` field, switching on
 * STAGE2_PROCESSING and STAGE2_COMPLETED — values no migration defines and the
 * backend never sends. So the second stage was invisible however far along it
 * was.
 *
 * The database models stage 2 as four *child* automations, one per domain, each
 * with its own status. That is the thing to read. Derived here rather than in a
 * component so the question "is this run finished?" has one answer and can be
 * checked without a DOM.
 */

export const DILIGENCE_STAGES = [
  AutomationStage.DILLIGENCE_OPERATIONAL,
  AutomationStage.DILLIGENCE_COMMERCIAL,
  AutomationStage.DILLIGENCE_FINANCIAL,
  AutomationStage.DILLIGENCE_CAP_TABLE_AND_LEGAL_REVIEW,
] as const

/** What to call each stage in front of a person. */
export const STAGE_LABELS: Record<AutomationStage, string> = {
  [AutomationStage.TRIAGE]: "Triage",
  [AutomationStage.DILLIGENCE_OPERATIONAL]: "Operational",
  [AutomationStage.DILLIGENCE_COMMERCIAL]: "Commercial",
  [AutomationStage.DILLIGENCE_FINANCIAL]: "Financial",
  [AutomationStage.DILLIGENCE_CAP_TABLE_AND_LEGAL_REVIEW]: "Cap table & legal",
}

export type Phase =
  | "not_started"
  | "triage_running"
  | "triage_failed"
  | "triage_done"
  | "reports_running"
  | "reports_partial"
  | "reports_done"

export interface DomainRun {
  stage: AutomationStage
  label: string
  automation: Automation
  status: AutomationStatus
  failureReason?: string | null
}

export interface RunState {
  phase: Phase
  /** The TRIAGE automation, which owns the analysis and the memorandum. */
  triage?: Automation
  /** The four domain runs, present once stage 2 has been started. */
  domains: DomainRun[]
  /** True while anything is still moving, so the screen knows to keep polling. */
  active: boolean
  /** Set when something failed, in the words the backend recorded. */
  failureReason?: string | null
}

const RUNNING = [AutomationStatus.NOT_STARTED, AutomationStatus.PENDING, AutomationStatus.PROCESSING]

const isRunning = (a: Automation) => RUNNING.includes(a.status)

/**
 * The most recent triage run, not merely the first one found.
 *
 * A company can be analysed more than once, and a retry adds a row rather than
 * replacing one. Reading the earliest would pin the screen to a stale analysis.
 */
function latestTriage(automations: Automation[]): Automation | undefined {
  return automations
    .filter((a) => a.stage === AutomationStage.TRIAGE)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]
}

export function runState(automations: Automation[] = []): RunState {
  const triage = latestTriage(automations)

  const domains: DomainRun[] = DILIGENCE_STAGES.flatMap((stage) => {
    const match = automations
      .filter((a) => a.stage === stage)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]
    return match
      ? [
          {
            stage,
            label: STAGE_LABELS[stage],
            automation: match,
            status: match.status,
            failureReason: match.failureReason,
          },
        ]
      : []
  })

  if (!triage) {
    return { phase: "not_started", domains: [], active: false }
  }

  if (isRunning(triage)) {
    return { phase: "triage_running", triage, domains, active: true }
  }

  if (triage.status === AutomationStatus.FAILED) {
    return {
      phase: "triage_failed",
      triage,
      domains,
      active: false,
      failureReason: triage.failureReason,
    }
  }

  if (domains.length === 0) {
    return { phase: "triage_done", triage, domains, active: false }
  }

  if (domains.some((d) => isRunning(d.automation))) {
    return { phase: "reports_running", triage, domains, active: true }
  }

  const failed = domains.filter((d) => d.status === AutomationStatus.FAILED)
  if (failed.length === domains.length) {
    return {
      phase: "reports_partial",
      triage,
      domains,
      active: false,
      // Named, not counted. "4 reports failed" sends someone to the logs; the
      // reason the backend recorded is the thing that answers the question.
      failureReason: failed[0]?.failureReason,
    }
  }
  if (failed.length > 0) {
    return {
      phase: "reports_partial",
      triage,
      domains,
      active: false,
      failureReason: failed[0]?.failureReason,
    }
  }

  return { phase: "reports_done", triage, domains, active: false }
}

/** One sentence describing where the run is, for a header or a list row. */
export function phaseLabel(state: RunState): string {
  switch (state.phase) {
    case "not_started":
      return "No dataroom uploaded"
    case "triage_running":
      return "Reading the dataroom"
    case "triage_failed":
      return "Analysis failed"
    case "triage_done":
      return "Memorandum ready"
    case "reports_running":
      return `Writing domain reports (${
        state.domains.filter((d) => d.status === AutomationStatus.COMPLETED).length
      } of ${state.domains.length})`
    case "reports_partial":
      return "Some domain reports failed"
    case "reports_done":
      return "Complete"
  }
}
