import type {
  CreateOverrideInput,
  OverrideRecord,
  OverridesResponse,
} from "@/domain/overrides/models/override"

export async function fetchOverrides(
  automationId: string,
): Promise<OverridesResponse> {
  const response = await fetch(`/api/automation/${automationId}/overrides`, {
    headers: { Accept: "application/json" },
  })
  if (!response.ok) {
    throw new Error(`The recorded judgement could not be loaded (${response.status}).`)
  }
  return (await response.json()) as OverridesResponse
}

export async function createOverride(
  automationId: string,
  input: CreateOverrideInput,
): Promise<OverrideRecord> {
  const response = await fetch(`/api/automation/${automationId}/overrides`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error(
      response.status === 400
        ? "A reason is required before a value can be changed."
        : `The change could not be saved (${response.status}).`,
    )
  }
  return (await response.json()) as OverrideRecord
}
