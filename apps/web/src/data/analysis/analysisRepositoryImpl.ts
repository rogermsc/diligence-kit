import type { AnalysisResponse } from "@/domain/analysis/models/analysis"

export class AnalysisNotAvailableError extends Error {
  constructor(readonly status: number) {
    super(
      status === 404
        ? "This run has no stored analysis."
        : `Could not load the analysis (${status}).`,
    )
    this.name = "AnalysisNotAvailableError"
  }
}

/**
 * Fetches the structured analysis through the BFF, so the token stays on the
 * server.
 *
 * `analysis: null` is a legitimate answer, not an error — runs that completed
 * before it was persisted still have their PDF, and callers fall back to the
 * download.
 */
export async function fetchAnalysis(
  triageAutomationId: string,
): Promise<AnalysisResponse> {
  const response = await fetch(
    `/api/company/automation/${triageAutomationId}/analysis`,
    { headers: { Accept: "application/json" } },
  )

  if (!response.ok) {
    throw new AnalysisNotAvailableError(response.status)
  }

  return (await response.json()) as AnalysisResponse
}
