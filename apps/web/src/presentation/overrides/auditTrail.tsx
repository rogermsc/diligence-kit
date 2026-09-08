"use client"

import { useRun } from "@/presentation/run/runContext"

/**
 * Every judgement recorded on this run, in the order it was made.
 *
 * The overrides table was designed as the audit trail — append-only, with the
 * author restricted from deletion so removing a user cannot rewrite the history
 * of a run they made decisions on. Nothing displayed it.
 *
 * A withdrawal appears as its own entry rather than removing the earlier one.
 * A trail that can be edited is not a trail.
 */
export function AuditTrail() {
  const { overrideHistory } = useRun()
  if (overrideHistory.length === 0) return null

  return (
    <section className="border-t border-border pt-5">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
        Human judgement
      </h2>
      <p className="mb-4 max-w-[68ch] text-xs leading-relaxed text-muted-foreground">
        Recorded beside the analysis, never inside it. The pipeline&apos;s own
        output is unchanged; these are the values a person decided differently,
        and why.
      </p>

      <ol className="flex flex-col gap-3">
        {overrideHistory.map((row) => (
          <li
            key={row.id}
            className="border-l-2 border-accent/60 pl-3 text-xs leading-relaxed"
          >
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono">{row.targetKey}</span>
              <span className="text-muted-foreground">
                {row.value === null || row.value === undefined
                  ? row.targetType === "ANNOTATION"
                    ? "annotated"
                    : "withdrawn"
                  : `set to ${String(row.value)}`}
              </span>
            </div>
            <p className="mt-0.5">{row.rationale}</p>
            <p className="mt-0.5 font-mono text-[0.7rem] text-muted-foreground">
              {new Date(row.createdAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}
