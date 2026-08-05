import type { AutomationRepository } from "../repositories/automationRepository";

export class DownloadOnePagerUseCase {
    constructor(private repository: AutomationRepository) { }

    async execute(triageAutomationId: string, fileName?: string): Promise<void> {
        try {
            if (!triageAutomationId || !triageAutomationId.trim()) {
                throw new Error("Triage Automation ID is required");
            }

            console.log("UseCase: Downloading one-pager for:", triageAutomationId);
            const blob = await this.repository.downloadOnePager(triageAutomationId.trim());

            // Extract filename or use default with proper extension (likely PDF)
            const defaultFileName = fileName || `one_pager_${triageAutomationId}.pdf`;

            // Create a URL for the blob
            const url = window.URL.createObjectURL(blob);

            // Create a temporary anchor element to trigger the download
            const link = document.createElement('a');
            link.href = url;
            link.download = defaultFileName;
            link.style.display = 'none';

            // Add to DOM, click, and remove
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up the blob URL
            window.URL.revokeObjectURL(url);

            console.log("UseCase: One-pager download completed");
        } catch (error) {
            console.error("Failed to download one pager:", error);
            throw new Error("Unable to download one pager at this time");
        }
    }
}
