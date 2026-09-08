import type { Company } from "@/domain/companies/models/company";
import { httpClient } from "@/lib/httpClient";

/**
 * Companies, over the BFF so the JWT stays on the server.
 *
 * Every method used to wrap its one call in a catch that logged and rethrew.
 * That is not error handling — it is the same error, later, plus a console
 * line. Errors travel as ApiError with the status and the server's own message
 * and are handled where a screen can say something useful about them.
 */
export class CompanyRepositoryImpl {
  async getCompanies(): Promise<Company[]> {
    return httpClient.get<Company[]>("/company");
  }

  async getCompanyById(id: string): Promise<Company> {
    return httpClient.get<Company>(`/company/${id}`);
  }

  async createCompany(name: string): Promise<Company> {
    return httpClient.post<Company>("/company", { name });
  }

  async deleteCompany(id: string): Promise<{ success: boolean; message: string }> {
    return httpClient.delete<{ success: boolean; message: string }>(`/company/${id}`);
  }
}
