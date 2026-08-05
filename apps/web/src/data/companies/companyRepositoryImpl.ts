import type { Company } from "@/domain/companies/models/company";
import type { CompanyRepository } from "@/domain/companies/repositories/companyRepository";
import { httpClient } from "@/lib/httpClient";

/**
 * Implementation of CompanyRepository that fetches from internal API routes
 */
export class CompanyRepositoryImpl implements CompanyRepository {
  async getCompanies(): Promise<Company[]> {
    try {
      return await httpClient.get<Company[]>("/company");
    } catch (error) {
      console.error("Error fetching companies from API:", error);
      throw error;
    }
  }

  async getCompanyById(id: string): Promise<Company> {
    try {
      return await httpClient.get<Company>(`/company/${id}`);
    } catch (error) {
      console.error("Error fetching company from API:", error);
      throw error;
    }
  }

  async createCompany(name: string): Promise<Company> {
    try {
      return await httpClient.post<Company>("/company", { name });
    } catch (error) {
      console.error("Error creating company:", error);
      throw error;
    }
  }

  async deleteCompany(id: string): Promise<{ success: boolean; message: string }> {
    try {
      return await httpClient.delete<{ success: boolean; message: string }>(`/company/${id}`);
    } catch (error) {
      console.error("Error deleting company:", error);
      throw error;
    }
  }
}
