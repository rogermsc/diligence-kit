import type { AutomationRepositoryImpl } from "@/data/automations/automationRepositoryImpl";
import { saveBlob } from "@/lib/saveBlob";

export class DownloadReportUseCase {
    constructor(private automationRepository: AutomationRepositoryImpl) { }

    async execute(automationId: string, fileName?: string): Promise<void> {
        try {
            if (!automationId || !automationId.trim()) {
                throw new Error("Automation ID is required");
            }

            console.log("UseCase: Downloading report for automation:", automationId);
            const blob = await this.automationRepository.downloadReport(automationId.trim());

            // Extract filename or use default with proper extension (likely PDF)
            const defaultFileName = fileName || `report_${automationId}.pdf`;
            saveBlob(blob, defaultFileName);
            console.log("UseCase: Report download completed");
        } catch (error) {
            console.error("Failed to download report:", error);
            throw new Error("Unable to download report at this time");
        }
    }
}
