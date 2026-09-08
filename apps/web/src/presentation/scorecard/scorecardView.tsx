"use client"

import { useMemo, useState } from "react"

import type { OnePager } from "@/domain/analysis/models/analysis"
import {
  applyWeights,
  buildScorecard,
  MIN_COVERAGE_TO_PUBLISH,
} from "@/domain/analysis/usecases/scorecard"
import { OverrideDialog } from "@/presentation/overrides/overrideDialog"
import { useRun } from "@/presentation/run/runContext"

/**
 * The scorecard, and its working.
 *
 * `buildScorecard` and `applyWeights` were written, unit-tested and imported by
 * nothing — the eight-category weighted rubric the README leads with existed
 * only inside a downloaded PDF. `applyWeights` in particular answers a question
 * a sceptic asks immediately and could not ask here: is this headline an
 * artefact of how it was weighted?
 *
 * The re-weighting is local to this browser and is never sent anywhere. It is
 * labelled as a what-if because a score someone reshaped for themselves must
 * never be mistaken for the one the pipeline published.
 */
export function ScorecardView({ onePager }: { onePager: OnePager }) {
  const model = useMemo(() => buildScorecard(onePager), [onePager])
  const [weights, setWeights] = useState<Record<string, number> | null>(null)
  const { state, effectiveOverrides, reload } = useRun()

  const overrideFor = (category: string) =>
    effectiveOverrides.find(
      (o) => o.targetType === "SCORECARD" && o.targetKey === `category:${category}`,
    )

  const whatIf = weights ? applyWeights(model.rows, weights) : null
  const current = weights ?? Object.fromEntries(model.rows.map((r) => [r.category, r.weight]))

  if (model.rows.length === 0) return null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-border pt-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          Investment readiness
        </h2>
        <div className="flex items-baseline gap-3">
          {model.suppressed ? (
            /*
              The backend refuses to publish an overall below this coverage, and
              the reason has to travel with the refusal — a blank where a score
              should be reads as a bug, not as a judgement.
            */
            <span className="text-sm text-missing">
              No overall score — the rubric is only{" "}
              <span data-numeric>{(model.coverage * 100).toFixed(0)}%</span>{" "}
              covered, below the{" "}
              <span data-numeric>{MIN_COVERAGE_TO_PUBLISH * 100}%</span> floor
            </span>
          ) : (
            <>
              <span
                className="font-mono text-3xl font-medium tracking-tight"
                data-numeric
              >
                {model.publishedOverall || model.overall?.toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">
                over{" "}
                <span data-numeric>{(model.coverage * 100).toFixed(0)}%</span> of
                the rubric
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col">
        {model.rows.map((row) => {
          const share = row.ceiling > 0 ? row.weighted / row.ceiling : 0
          return (
            <div
              key={row.category}
              className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 border-b border-border/50 py-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="text-sm font-medium">{row.category}</h3>
                  <span className="font-mono text-xs text-muted-foreground">
                    weight{" "}
                    <span data-numeric>{(row.weight * 100).toFixed(0)}%</span>
                  </span>
                </div>
                {row.keyIssues.length > 0 && (
                  <ul className="mt-1.5 flex flex-col gap-1 text-xs leading-relaxed text-muted-foreground">
                    {row.keyIssues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-1">
                  {(() => {
                    const override = overrideFor(row.category)
                    return override ? (
                      // Marked, never silently substituted. A value a person
                      // changed must not read as one the pipeline derived.
                      <span
                        className="font-mono text-sm text-accent"
                        title={`Changed by a person: ${override.rationale}`}
                        data-numeric
                      >
                        {String(override.value)}
                      </span>
                    ) : (
                      <span className="font-mono text-sm" data-numeric>
                        {row.score.toFixed(1)}
                        <span className="text-muted-foreground">/5</span>
                      </span>
                    )
                  })()}
                  {state.triage && (
                    <OverrideDialog
                      automationId={state.triage.id}
                      targetType="SCORECARD"
                      targetKey={`category:${row.category}`}
                      currentValue={row.score.toFixed(1)}
                      label={row.category}
                      onSaved={reload}
                    />
                  )}
                </div>
                {/* The bar is the contribution against the ceiling, not the raw
                    score — a 5.0 in a 5%-weighted category should not look like
                    the same result as a 5.0 in a 20% one. */}
                <div
                  className="h-1 w-24 overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={`${row.category}: ${row.weighted.toFixed(2)} of a possible ${row.ceiling.toFixed(2)}`}
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, share * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <details className="rounded-md border border-border bg-muted/20 p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Re-weight it yourself
        </summary>
        <p className="mt-2 max-w-[60ch] text-xs leading-relaxed text-muted-foreground">
          Move a category and the overall recomputes under your weights,
          renormalised so it stays on the same 0–5 scale. This runs in your
          browser, changes nothing, and is not saved or sent anywhere. Its only
          job is to answer whether the published figure is an artefact of the
          weighting.
        </p>

        <div className="mt-4 flex flex-col gap-2.5">
          {model.rows.map((row) => (
            <label
              key={row.category}
              className="grid grid-cols-[minmax(0,1fr)_8rem_3rem] items-center gap-3 text-xs"
            >
              <span className="truncate">{row.category}</span>
              <input
                type="range"
                min={0}
                max={40}
                step={1}
                value={Math.round((current[row.category] ?? 0) * 100)}
                onChange={(e) =>
                  setWeights({
                    ...current,
                    [row.category]: Number(e.target.value) / 100,
                  })
                }
                className="accent-primary"
              />
              <span className="text-right font-mono" data-numeric>
                {Math.round((current[row.category] ?? 0) * 100)}%
              </span>
            </label>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3 border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">
            Under your weights
          </span>
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-xl" data-numeric>
              {whatIf === null ? "—" : whatIf.toFixed(1)}
            </span>
            {weights && (
              <button
                type="button"
                onClick={() => setWeights(null)}
                className="text-xs text-primary underline underline-offset-2"
              >
                Reset to published
              </button>
            )}
          </div>
        </div>
      </details>
    </div>
  )
}
