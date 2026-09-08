"use client"

import { useCallback, useEffect, useState } from "react"

import { CompanyRepositoryImpl } from "@/data/companies/companyRepositoryImpl"
import type { Company } from "@/domain/companies/models/company"
import { runState } from "@/domain/automations/usecases/runState"
import { CreateCompanyUseCase } from "@/domain/companies/usecases/createCompany"
import { GetCompaniesUseCase } from "@/domain/companies/usecases/getCompanies"

/**
 * The company list.
 *
 * It polls while any run is still moving. Before, only the detail screen
 * refreshed itself, so the workflow the product is built around — start a run,
 * go and do something else — left this list showing a status frozen at the
 * moment it was opened, with a Refresh button as the only way to learn
 * otherwise.
 *
 * The load body used to be written out twice, once in an effect and once in
 * refetch, which is how two copies of the same fetch drift apart.
 */

const POLL_INTERVAL_MS = 15_000

export function useCompaniesViewModel() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const useCase = new GetCompaniesUseCase(new CompanyRepositoryImpl())
      setCompanies(await useCase.execute())
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The companies could not be loaded.",
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const anyActive = companies.some((c) => runState(c.automations).active)

  useEffect(() => {
    if (!anyActive) return
    const id = setInterval(() => void load(), POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [anyActive, load])

  const createCompany = useCallback(
    async (name: string): Promise<void> => {
      const useCase = new CreateCompanyUseCase(new CompanyRepositoryImpl())
      await useCase.execute(name)
      await load()
    },
    [load],
  )

  return { companies, loading, error, refetch: load, createCompany }
}
