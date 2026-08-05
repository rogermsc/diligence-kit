import { Company } from "../models/company";

/**
 * Repository interface for company data access
 */
export interface CompanyRepository {
  getCompanies(): Promise<Company[]>;
  getCompanyById(id: string): Promise<Company>;
  createCompany(name: string): Promise<Company>;
  deleteCompany(id: string): Promise<{ success: boolean; message: string }>;
}
