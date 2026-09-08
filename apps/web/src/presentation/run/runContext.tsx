"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import { fetchAnalysis } from "@/data/analysis/analysisRepositoryImpl"
import { CompanyRepositoryImpl } from "@/data/companies/companyRepositoryImpl"
import type { Analysis } from "@/domain/analysis/models/analysis"
import { fetchOverrides } from "@/data/overrides/overrideRepositoryImpl"
import type { OverrideRecord } from "@/domain/overrides/models/override"
import { summariseVerification } from "@/domain/analysis/usecases/verification"
import { buildConflictCases } from "@/domain/analysis/usecases/conflicts"
import { buildChatContext } from "@/domain/analysis/usecases/chatContext"
import { useCompanyContext } from "@/components/chat/chat-company-context"
import { runState, type RunState } from "@/domain/automations/usecases/runState"
import { GetCompanyByIdUseCase } from "@/domain/companies/usecases/getCompanyById"
import type { Company } from "@/domain/companies/models/company"

/**
 * One fetch of a run, shared by every screen that shows part of it.
 *
 * The memorandum, the evidence table and the contradictions are three views of
 * a single payload. Fetching it per route would mean three requests, three
 * loading states and three chances to disagree about what the run says — which
 * is roughly what the app did before, with the company page and the
 * contradictions page reading different endpoints and never meeting.
 *
 * Polling lives here too, so a header count and a page body can never be a
 * refresh apart.
 */

const POLL_INTERVAL_MS = 10_000

export interface RunContextValue {
  companyId: string
  company: Company | null
  analysis: Analysis | null
  state: RunState
  loading: boolean
  /** Why the run could not be loaded, in the server's own words. */
  error: string | null
  /** True when the company exists but has no stored analysis to show. */
  analysisUnavailable: boolean
  /** Values a person changed, last write per target. */
  effectiveOverrides: OverrideRecord[]
  /** Every judgement recorded on this run, oldest first. */
  overrideHistory: OverrideRecord[]
  conflictCount: number
  unresolvedCount: number
  verifiedCount: number
  factCount: number
  reload: () => void
}

const RunContext = createContext<RunContextValue | null>(null)

export function useRun(): RunContextValue {
  const value = useContext(RunContext)
  if (!value) throw new Error("useRun must be used inside RunProvider")
  return value
}

export function RunProvider({
  companyId,
  children,
}: {
  companyId: string
  children: React.ReactNode
}) {
  const [company, setCompany] = useState<Company | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [analysisUnavailable, setAnalysisUnavailable] = useState(false)
  const [effectiveOverrides, setEffectiveOverrides] = useState<OverrideRecord[]>([])
  const [overrideHistory, setOverrideHistory] = useState<OverrideRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const repository = new CompanyRepositoryImpl()
      const found = await new GetCompanyByIdUseCase(repository).execute(companyId)
      setCompany(found)
      setError(null)

      // A run with no completed triage has no analysis to fetch, and asking for
      // one would turn "not finished yet" into an error on screen.
      const state = runState(found?.automations)
      if (!state.triage || state.phase === "triage_running") {
        setAnalysis(null)
        setAnalysisUnavailable(false)
        return
      }

      const response = await fetchAnalysis(state.triage.id)
      setAnalysis(response.analysis)
      setAnalysisUnavailable(response.analysis === null)

      // A failure here must not lose the analysis that already loaded. Not
      // being able to read the judgement is worth saying; it is not worth
      // blanking the run over.
      try {
        const recorded = await fetchOverrides(state.triage.id)
        setEffectiveOverrides(recorded.effective)
        setOverrideHistory(recorded.history)
      } catch {
        setEffectiveOverrides([])
        setOverrideHistory([])
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The run could not be loaded.",
      )
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    void load()
  }, [load])

  const state = useMemo(() => runState(company?.automations), [company])

  // Only while something is moving. A finished run polled forever is a request
  // every ten seconds that can never change an answer.
  useEffect(() => {
    if (!state.active) return
    const id = setInterval(() => void load(), POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [state.active, load])

  // Hand the assistant what this run decided, so a question about a figure on
  // screen is answerable from the rule that settled it.
  const { setCompany: setChatCompany } = useCompanyContext()
  useEffect(() => {
    if (!company) return
    setChatCompany({
      id: company.id,
      name: company.name,
      automationId: state.triage?.id,
      analysisContext: analysis
        ? (buildChatContext(company.name, analysis) as unknown as Record<
            string,
            unknown
          >)
        : undefined,
    })
    return () => setChatCompany(null)
  }, [company, analysis, state.triage?.id, setChatCompany])

  const verification = useMemo(
    () => (analysis ? summariseVerification(analysis) : null),
    [analysis],
  )
  const cases = useMemo(
    () => (analysis ? buildConflictCases(analysis) : []),
    [analysis],
  )

  const value: RunContextValue = {
    companyId,
    company,
    analysis,
    state,
    loading,
    error,
    analysisUnavailable,
    effectiveOverrides,
    overrideHistory,
    conflictCount: cases.length,
    unresolvedCount: cases.filter((c) => !c.resolved).length,
    verifiedCount: verification?.verified ?? 0,
    factCount: verification?.total ?? 0,
    reload: () => void load(),
  }

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>
}
