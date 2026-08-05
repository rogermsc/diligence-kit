/**
 * Document entity representing a document uploaded for an automation
 */
export interface Document {
  id: string;
  automationId: string;
  name: string;
  bucketPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetDocumentsResponse {
  documents: Document[];
} 