import type { Company } from "../models/company";
import type { CompanyRepository } from "../repositories/companyRepository";

export class CreateCompanyUseCase {
  constructor(private repository: CompanyRepository) {}

  async execute(name: string): Promise<Company> {
    if (!name || !name.trim()) {
      throw new Error("Company name is required");
    }

    return await this.repository.createCompany(name.trim());
  }
} 