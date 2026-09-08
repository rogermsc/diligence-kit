/**
 * Exactly what the Postgres enum can hold, and nothing else.
 *
 * This used to carry three more members — STAGE2_PROCESSING, STAGE2_COMPLETED
 * and STAGE2_FAILED — that no migration ever defined and the backend never
 * emitted. Every branch that switched on them was unreachable, which is why the
 * whole second-stage section of the company screen, including its "analysis
 * complete" card, had never rendered for anyone.
 *
 * Stage 2 is not a status on this row. It is four child automations, and its
 * state is derived from them: see usecases/runState.ts.
 */
export enum AutomationStatus {
  NOT_STARTED = "NOT_STARTED",
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum AutomationStage {
  TRIAGE = "TRIAGE",
  DILLIGENCE_OPERATIONAL = "DILLIGENCE_OPERATIONAL",
  DILLIGENCE_COMMERCIAL = "DILLIGENCE_COMMERCIAL",
  DILLIGENCE_FINANCIAL = "DILLIGENCE_FINANCIAL",
  DILLIGENCE_CAP_TABLE_AND_LEGAL_REVIEW = "DILLIGENCE_CAP_TABLE_AND_LEGAL_REVIEW",
}

export interface DocumentStatus {
  id: string | null;
  name: string;
  status: "OK" | "MISSING";
}

/** Mirrors the Postgres enum. UNTRACKED is the default a report is created with. */
export enum ReportStatus {
  UNTRACKED = "UNTRACKED",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export interface Report {
  id: string;
  automationId: string;
  companyId: string;
  domain: string;
  status: ReportStatus;
  reportUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationResult {
  one_pager_summary?: string;
  onePagerSummary?: string;
  company_summary_documents?: DocumentStatus[];
  team_documents?: DocumentStatus[];
  corporate_documents?: DocumentStatus[];
  clients_documents?: DocumentStatus[];
  investment_documents?: DocumentStatus[];
  legal_documents?: DocumentStatus[];
  financial_documents?: DocumentStatus[];
}

export interface Automation {
  id: string;
  companyId: string;
  status: AutomationStatus;
  /** Why a FAILED run failed. Null on every run that has not. */
  failureReason?: string | null;
  stage?: AutomationStage;
  parentAutomationId?: string | null;
  onePagerSummary?: string | null;
  reports?: Report[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: AutomationResult | any | null;
  createdAt: string;
  updatedAt: string;
}

export interface StartStage2Response {
  success: boolean;
  message: string;
  automationId: string;
}

export interface StartStage2Request {
  companyId: string;
  automationId: string;
}
