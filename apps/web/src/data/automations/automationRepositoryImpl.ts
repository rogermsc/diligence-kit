import type {
    StartStage2Response,
    StartStage2Request,
} from "@/domain/automations/models/automation";
import type {AutomationRepository} from "@/domain/automations/repositories/automationRepository";
import {httpClient} from "@/lib/httpClient";

/**
 * Implementation of AutomationRepository that fetches from internal API routes
 */
export class AutomationRepositoryImpl implements AutomationRepository {
    async downloadOnePagerSummary(automationId: string): Promise<Blob> {
        try {
            return await httpClient.getBlob(
                `/automation/${automationId}/download-one-pager`
            );
        } catch (error) {
            console.error("Error downloading one pager summary from API:", error);
            throw error;
        }
    }

    async downloadOnePager(triageAutomationId: string): Promise<Blob> {
        try {
            console.log("Repository: Downloading one-pager for triage automation:", triageAutomationId);
            return await httpClient.getBlob(
                `/company/automation/${triageAutomationId}/one-pager`
            );
        } catch (error) {
            console.error("Error downloading one pager from API:", error);
            throw error;
        }
    }

    async downloadReport(automationId: string): Promise<Blob> {
        try {
            console.log("Repository: Downloading report for automation:", automationId);
            return await httpClient.getBlob(
                `/automation/${automationId}/download-report`
            );
        } catch (error) {
            console.error("Error downloading report from API:", error);
            throw error;
        }
    }

    async startStage2(request: StartStage2Request): Promise<StartStage2Response> {
        try {
            console.log("Repository: Starting stage 2 with request:", request);
            const response = await httpClient.post<StartStage2Response>(
                `/automation/${request.automationId}/start-stage-2`,
                {
                    companyId: request.companyId,
                    automationId: request.automationId,
                }
            );
            console.log("Repository: Stage 2 response:", response);
            return response;
        } catch (error) {
            console.error("Repository: Error starting automation stage 2:", error);

            // If it's an HTTP error, try to extract more details
            if (error && typeof error === 'object' && 'response' in error) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const httpError = error as any;
                console.error("Repository: HTTP error details:", {
                    status: httpError.response?.status,
                    statusText: httpError.response?.statusText,
                    data: httpError.response?.data
                });

                // If we have a specific error message from the API, use that
                if (httpError.response?.data?.message) {
                    throw new Error(httpError.response.data.message);
                }

                if (httpError.response?.data?.error) {
                    throw new Error(httpError.response.data.error);
                }
            }

            throw error;
        }
    }

    async retryAutomation(
        automationId: string
    ): Promise<{ automationId: string; status: string }> {
        return await httpClient.post<{ automationId: string; status: string }>(
            `/automation/${automationId}/retry`,
            {}
        );
    }
}
