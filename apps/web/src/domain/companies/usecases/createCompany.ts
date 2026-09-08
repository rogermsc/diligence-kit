import type { CompanyRepositoryImpl } from "@/data/companies/companyRepositoryImpl";
import type { Company } from "../models/company";

export class CreateCompanyUseCase {
  constructor(private repository: CompanyRepositoryImpl) {}

  async execute(name: string): Promise<Company> {
    if (!name || !name.trim()) {
      throw new Error("Company name is required");
    }

    return await this.repository.createCompany(name.trim());
  }
} 