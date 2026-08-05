import { ReportPayload } from "@/features/onePager-agent/report/domain/interfaces/report-payload.interface";

export interface ReportCompleted {
    companyName: string;
    automationId: string;
    reports: ReportPayload[];
}