import type { DocumentRepositoryImpl } from "@/data/documents/documentRepositoryImpl";
import type { GetDocumentsResponse } from "../models/document";

export class GetDocumentsByAutomationIdUseCase {
  constructor(private documentRepository: DocumentRepositoryImpl) {}

  async execute(automationId: string): Promise<GetDocumentsResponse> {
    try {
      if (!automationId || !automationId.trim()) {
        throw new Error("Automation ID is required");
      }

      return await this.documentRepository.getDocumentsByAutomationId(automationId.trim());
    } catch (error) {
      console.error("Failed to fetch documents:", error);
      throw new Error("Unable to retrieve documents at this time");
    }
  }
} 