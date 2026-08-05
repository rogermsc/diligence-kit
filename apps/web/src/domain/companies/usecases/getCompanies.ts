import type { Company } from "../models/company";
import type { CompanyRepository } from "../repositories/companyRepository";

/**
 * Use case for retrieving companies under due diligence
 */
export class GetCompaniesUseCase {
  constructor(private companyRepository: CompanyRepository) {}

  async execute(): Promise<Company[]> {
    try {
      return await this.companyRepository.getCompanies();
    } catch (error) {
      console.error("Failed to fetch companies:", error);
      throw new Error("Unable to retrieve companies at this time");
    }
  }
}
