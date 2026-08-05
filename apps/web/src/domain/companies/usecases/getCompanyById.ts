import type { Company } from "../models/company";
import type { CompanyRepository } from "../repositories/companyRepository";

export class GetCompanyByIdUseCase {
  constructor(private companyRepository: CompanyRepository) {}

  async execute(id: string): Promise<Company | null> {
    try {
      return await this.companyRepository.getCompanyById(id);
    } catch (error) {
      console.error("Failed to fetch company:", error);
      return null;
    }
  }
}
