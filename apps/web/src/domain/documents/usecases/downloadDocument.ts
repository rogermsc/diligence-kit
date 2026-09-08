import type { DocumentRepositoryImpl } from "@/data/documents/documentRepositoryImpl";
import { saveBlob } from "@/lib/saveBlob";

export class DownloadDocumentUseCase {
  constructor(private documentRepository: DocumentRepositoryImpl) {}

  async execute(documentId: string, fileName: string): Promise<void> {
    try {
      if (!documentId || !documentId.trim()) {
        throw new Error("Document ID is required");
      }

      if (!fileName || !fileName.trim()) {
        throw new Error("File name is required");
      }

      const blob = await this.documentRepository.downloadDocument(documentId.trim());
      saveBlob(blob, fileName.trim());
    } catch (error) {
      console.error("Failed to download document:", error);
      throw new Error("Unable to download document at this time");
    }
  }
} 