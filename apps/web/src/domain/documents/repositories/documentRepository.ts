import { GetDocumentsResponse } from "../models/document";

/**
 * Repository interface for document data access
 */
export interface DocumentRepository {
  getDocumentsByAutomationId(automationId: string): Promise<GetDocumentsResponse>;
  downloadDocument(documentId: string): Promise<Blob>;
} 