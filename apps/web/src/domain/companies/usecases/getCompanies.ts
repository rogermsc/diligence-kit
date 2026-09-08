import type { CompanyRepositoryImpl } from "@/data/companies/companyRepositoryImpl";
import type { Company } from "../models/company";

/**
 * Every company under diligence.
 *
 * The error is passed through rather than replaced. This used to swallow the
 * ApiError — status code, type, and the server's own message — and throw
 * "Unable to retrieve companies at this time" instead, so a rate limit, an
 * expired session and a database outage were one sentence on screen.
 */
export class GetCompaniesUseCase {
  constructor(private companyRepository: CompanyRepositoryImpl) {}

  async execute(): Promise<Company[]> {
    return this.companyRepository.getCompanies();
  }
}
