"use client"

import { useState, useEffect } from "react"
import type { Company } from "@/domain/companies/models/company"
import { GetCompaniesUseCase } from "@/domain/companies/usecases/getCompanies"
import { CreateCompanyUseCase } from "@/domain/companies/usecases/createCompany"
import { CompanyRepositoryImpl } from "@/data/companies/companyRepositoryImpl"

/**
 * ViewModel for managing company dashboard state and interactions
 */
export function useCompaniesViewModel() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        setLoading(true)
        setError(null)

        // Dependency injection - create repository and use case
        const repository = new CompanyRepositoryImpl()
        const getCompaniesUseCase = new GetCompaniesUseCase(repository)

        const fetchedCompanies = await getCompaniesUseCase.execute()
        setCompanies(fetchedCompanies)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred"
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    loadCompanies()
  }, [])

  const refetch = async () => {
    const repository = new CompanyRepositoryImpl()
    const getCompaniesUseCase = new GetCompaniesUseCase(repository)

    try {
      setLoading(true)
      setError(null)
      const fetchedCompanies = await getCompaniesUseCase.execute()
      setCompanies(fetchedCompanies)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred"
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const createCompany = async (name: string): Promise<void> => {
    const repository = new CompanyRepositoryImpl()
    const createCompanyUseCase = new CreateCompanyUseCase(repository)

    try {
      await createCompanyUseCase.execute(name)
      await refetch()
    } catch (err) {
      // Re-throw the original error to preserve ApiError type and properties
      throw err
    }
  }

  return {
    companies,
    loading,
    error,
    refetch,
    createCompany,
  }
}
