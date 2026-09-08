import type { AutomationRepositoryImpl } from "@/data/automations/automationRepositoryImpl";
import { saveBlob } from "@/lib/saveBlob";

export class DownloadOnePagerUseCase {
    constructor(private repository: AutomationRepositoryImpl) { }

    async execute(triageAutomationId: string, fileName?: string): Promise<void> {
        try {
            if (!triageAutomationId || !triageAutomationId.trim()) {
                throw new Error("Triage Automation ID is required");
            }

            console.log("UseCase: Downloading one-pager for:", triageAutomationId);
            const blob = await this.repository.downloadOnePager(triageAutomationId.trim());

            // Extract filename or use default with proper extension (likely PDF)
            const defaultFileName = fileName || `one_pager_${triageAutomationId}.pdf`;
            saveBlob(blob, defaultFileName);
            console.log("UseCase: One-pager download completed");
        } catch (error) {
            console.error("Failed to download one pager:", error);
            throw new Error("Unable to download one pager at this time");
        }
    }
}
