import { Automation } from "../../automations/models/automation";

export enum CompanyStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * Company entity representing a company under due diligence
 */
export interface Company {
  id: string;
  name: string;
  status: CompanyStatus;
  createdAt: string;
  updatedAt: string;
  automations: Automation[];
}
