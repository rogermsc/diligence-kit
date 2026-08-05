import type { StartAutomationResponse } from "../models/automation";
import type { AutomationRepository } from "../repositories/automationRepository";

export class StartAutomationUseCase {
  constructor(private repository: AutomationRepository) {}

  async execute(companyId: string, file: File): Promise<StartAutomationResponse> {
    if (!companyId || !companyId.trim()) {
      throw new Error("Company ID is required");
    }

    if (!file) {
      throw new Error("Automation file is required");
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.zip')) {
      throw new Error("Only ZIP files are supported");
    }

    return await this.repository.startAutomation(companyId.trim(), file);
  }
} 