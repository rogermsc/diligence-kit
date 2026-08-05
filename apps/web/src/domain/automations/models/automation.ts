export enum AutomationStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  STAGE2_PROCESSING = "STAGE2_PROCESSING",
  STAGE2_COMPLETED = "STAGE2_COMPLETED",
  STAGE2_FAILED = "STAGE2_FAILED",
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

export enum ReportStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
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
  one_pager_markdown?: string;
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
  stage?: AutomationStage;
  parentAutomationId?: string | null;
  onePagerSummary?: string | null;
  reports?: Report[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: AutomationResult | any | null;
  createdAt: string;
  updatedAt: string;
}

export interface StartAutomationResponse {
  automation: Automation;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agentResponse: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  documents: any[];
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
