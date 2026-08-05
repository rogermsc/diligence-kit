import type {
  StartStage2Response,
  StartStage2Request,
} from "../models/automation";
import type { AutomationRepository } from "../repositories/automationRepository";

export class StartAutomationStage2UseCase {
  constructor(private repository: AutomationRepository) {}

  async execute(
    companyId: string,
    automationId: string
  ): Promise<StartStage2Response> {
    if (!companyId || !companyId.trim()) {
      throw new Error("Company ID is required");
    }

    if (!automationId || !automationId.trim()) {
      throw new Error("Automation ID is required");
    }

    const request: StartStage2Request = {
      companyId: companyId.trim(),
      automationId: automationId.trim(),
    };

    try {
      return await this.repository.startStage2(request);
    } catch (error) {
      console.error("Failed to start automation stage 2:", error);

      if (error instanceof Error) {
        throw error;
      }

      throw new Error("Unable to start stage 2 automation at this time");
    }
  }
}
