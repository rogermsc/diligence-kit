import {
  StartStage2Response,
  StartStage2Request,
} from "../models/automation";

/**
 * Repository interface for automation data access
 */
export interface AutomationRepository {
  downloadOnePagerSummary(automationId: string): Promise<Blob>;
  downloadOnePager(triageAutomationId: string): Promise<Blob>;
  downloadReport(automationId: string): Promise<Blob>;
  startStage2(request: StartStage2Request): Promise<StartStage2Response>;
  retryAutomation(automationId: string): Promise<{ automationId: string; status: string }>;
}
