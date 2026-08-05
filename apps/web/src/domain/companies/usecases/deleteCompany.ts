import type { CompanyRepository } from "../repositories/companyRepository";

export class DeleteCompanyUseCase {
  constructor(private companyRepository: CompanyRepository) {}

  async execute(id: string): Promise<{ success: boolean; message: string }> {
    try {
      return await this.companyRepository.deleteCompany(id);
    } catch (error) {
      console.error("Failed to delete company:", error);
      throw error;
    }
  }
}

