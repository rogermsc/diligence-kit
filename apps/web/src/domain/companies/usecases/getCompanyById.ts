import type { CompanyRepositoryImpl } from "@/data/companies/companyRepositoryImpl";
import { ApiError } from "@/lib/httpClient";
import type { Company } from "../models/company";

/**
 * One company, or a thrown error saying why not.
 *
 * This used to catch everything and return null, which the screen renders as
 * "Company not found". So a 500, a dropped connection and an expired session
 * all told the user their company did not exist — and because the caller never
 * saw an error, the "Try again" branch beside that message was unreachable.
 *
 * A missing company is a 404 and the repository already reports it as one. The
 * only null this returns now is that.
 */
export class GetCompanyByIdUseCase {
  constructor(private companyRepository: CompanyRepositoryImpl) {}

  async execute(id: string): Promise<Company | null> {
    try {
      return await this.companyRepository.getCompanyById(id);
    } catch (error) {
      // 404 is the one answer that means "no such company" — and the backend
      // returns 404 rather than 403 for a company owned by someone else, so
      // this is also what a tenancy miss looks like. Everything else is a
      // failure the user needs told about.
      if (error instanceof ApiError && error.statusCode === 404) return null;
      throw error;
    }
  }
}
