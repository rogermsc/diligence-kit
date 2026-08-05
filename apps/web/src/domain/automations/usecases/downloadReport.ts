import { AutomationRepository } from "../repositories/automationRepository";

export class DownloadReportUseCase {
    constructor(private automationRepository: AutomationRepository) { }

    async execute(automationId: string, fileName?: string): Promise<void> {
        try {
            if (!automationId || !automationId.trim()) {
                throw new Error("Automation ID is required");
            }

            console.log("UseCase: Downloading report for automation:", automationId);
            const blob = await this.automationRepository.downloadReport(automationId.trim());

            // Extract filename or use default with proper extension (likely PDF)
            const defaultFileName = fileName || `report_${automationId}.pdf`;

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

            console.log("UseCase: Report download completed");
        } catch (error) {
            console.error("Failed to download report:", error);
            throw new Error("Unable to download report at this time");
        }
    }
}
