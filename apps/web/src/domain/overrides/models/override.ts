/**
 * A person's judgement about one value in a run.
 *
 * Kept beside the analysis, never inside it — the same discipline the product
 * applies to a dataroom, turned on its own users. A figure is worth what its
 * source is worth, so a value a person changed can never be presented as one
 * the pipeline derived.
 */

export type OverrideTargetType = "FACT" | "CONFLICT" | "SCORECARD" | "ANNOTATION"

export interface OverrideRecord {
  id: string
  automationId: string
  targetType: OverrideTargetType
  /** A fact or conflict field, or "category:Financial Readiness" for a score. */
  targetKey: string
  /** Null on an annotation, and on a withdrawal of an earlier override. */
  value: unknown
  /** Required by the database. An override with no stated reason is the
   *  unsourced assertion this product exists to argue against. */
  rationale: string
  authorId: string
  createdAt: string
}

export interface OverridesResponse {
  /** Every row, oldest first — the trail as written. */
  history: OverrideRecord[]
  /** Last write wins per target, withdrawals removed. */
  effective: OverrideRecord[]
  annotations: OverrideRecord[]
}

export interface CreateOverrideInput {
  targetType: OverrideTargetType
  targetKey: string
  value?: unknown
  rationale: string
}
