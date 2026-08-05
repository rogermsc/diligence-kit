import type { GetDocumentsResponse } from "@/domain/documents/models/document";
import type { DocumentRepository } from "@/domain/documents/repositories/documentRepository";
import { httpClient } from "@/lib/httpClient";

/**
 * Implementation of DocumentRepository that fetches from internal API routes
 */
export class DocumentRepositoryImpl implements DocumentRepository {
  async getDocumentsByAutomationId(automationId: string): Promise<GetDocumentsResponse> {
    try {
      return await httpClient.get<GetDocumentsResponse>(`/automation/${automationId}/documents`);
    } catch (error) {
      console.error("Error fetching documents from API:", error);
      throw error;
    }
  }

  async downloadDocument(documentId: string): Promise<Blob> {
    try {
      return await httpClient.getBlob(`/automation/documents/${documentId}/download`);
    } catch (error) {
      console.error("Error downloading document from API:", error);
      throw error;
    }
  }
} 