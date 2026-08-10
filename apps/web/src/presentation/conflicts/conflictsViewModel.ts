"use client"

import { useCallback, useEffect, useState } from "react"

import { fetchAnalysis } from "@/data/analysis/analysisRepositoryImpl"
import type { Analysis } from "@/domain/analysis/models/analysis"
import {
  buildConflictCases,
  corroboratedFields,
  type ConflictCase,
} from "@/domain/analysis/usecases/conflicts"

export interface ConflictsViewState {
  loading: boolean
  /** Set when the analysis could not be loaded at all. */
  error: string | null
  /** True when the run completed before the analysis was persisted. */
  unavailable: boolean
  cases: ConflictCase[]
  corroborated: string[]
  analysis: Analysis | null
  reload: () => void
}

export function useConflictsViewModel(
  triageAutomationId: string,
): ConflictsViewState {
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchAnalysis(triageAutomationId)
      .then((response) => {
        if (cancelled) return
        setAnalysis(response.analysis)
        setUnavailable(response.analysis === null)
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [triageAutomationId])

  useEffect(() => load(), [load])

  return {
    loading,
    error,
    unavailable,
    analysis,
    cases: analysis ? buildConflictCases(analysis) : [],
    corroborated: analysis ? corroboratedFields(analysis) : [],
    reload: load,
  }
}
