import type { DocumentRepository } from "../repositories/documentRepository";

export class DownloadDocumentUseCase {
  constructor(private documentRepository: DocumentRepository) {}

  async execute(documentId: string, fileName: string): Promise<void> {
    try {
      if (!documentId || !documentId.trim()) {
        throw new Error("Document ID is required");
      }

      if (!fileName || !fileName.trim()) {
        throw new Error("File name is required");
      }

      const blob = await this.documentRepository.downloadDocument(documentId.trim());
      
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element to trigger the download
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName.trim();
      link.style.display = 'none';
      
      // Add to DOM, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error("Failed to download document:", error);
      throw new Error("Unable to download document at this time");
    }
  }
} 