import type { AutomationRepository } from "../repositories/automationRepository";

export class DownloadOnePagerSummaryUseCase {
  constructor(private repository: AutomationRepository) {}

  async execute(automationId: string, fileName?: string): Promise<void> {
    try {
      if (!automationId || !automationId.trim()) {
        throw new Error("Automation ID is required");
      }

      const blob = await this.repository.downloadOnePagerSummary(automationId.trim());
      
      // Extract filename from the original path or use default
      const defaultFileName = fileName || `one_pager_summary_${automationId}.docx`;
      
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
      
    } catch (error) {
      console.error("Failed to download one pager summary:", error);
      throw new Error("Unable to download one pager summary at this time");
    }
  }
} 