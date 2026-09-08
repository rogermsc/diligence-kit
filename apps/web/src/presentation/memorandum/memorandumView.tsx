"use client"

import type { OnePager } from "@/domain/analysis/models/analysis"
import { Badge } from "@/components/ui/badge"

/**
 * The investment memorandum, on screen.
 *
 * There was no such screen. The company page rendered `one_pager_markdown`, a
 * key nothing in the system has ever produced, so the condition guarding it was
 * never true and every reader fell through to a Download button. The analysis
 * behind it — this whole object — was already being fetched by the
 * contradictions page one route away.
 *
 * Set in the display serif because that is the job the root layout gives it:
 * "Newsreader for synthesis a model wrote". Everything transcribed out of a
 * document stays in mono. The distinction is the point — a reader should be
 * able to see, without being told, which words the pipeline wrote and which it
 * copied.
 */

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-border pt-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
        {title}
      </h2>
      {children}
    </section>
  )
}

/**
 * A label and its value.
 *
 * "Not available in dataroom" is the prompt's own words for an absence, and it
 * is rendered as an absence rather than as text — a reader scanning for gaps
 * should be able to find them without reading every line.
 */
function Field({ label, value }: { label: string; value: string }) {
  const absent = !value || /^not available|^no audited/i.test(value)
  return (
    <div className="flex flex-col gap-1 py-2">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={
          absent
            ? "text-sm text-missing"
            : "font-mono text-sm text-foreground"
        }
        data-numeric
      >
        {absent ? value || "Not stated" : value}
      </dd>
    </div>
  )
}

function FieldGrid({ entries }: { entries: [string, string][] }) {
  return (
    <dl className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map(([label, value]) => (
        <Field key={label} label={label} value={value} />
      ))}
    </dl>
  )
}

const humanise = (key: string) =>
  key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())

const entriesOf = (record: Record<string, string> = {}): [string, string][] =>
  Object.entries(record).map(([k, v]) => [humanise(k), v])

export function MemorandumView({ onePager }: { onePager: OnePager }) {
  const highlights = onePager.financial_highlights ?? {}
  const projections = highlights.projections

  return (
    <article className="flex flex-col gap-8">
      {/*
        The pipeline checked whether the memo printed the figure its own rule
        chose, and that check used to end at a log line — the PDF shipped and
        every caller reported success. If it fired, it is the first thing a
        reader needs, above the prose it contradicts.
      */}
      {onePager.adjudication_mismatches?.length ? (
        <div className="rounded-md border border-conflict/40 bg-conflict-bg p-4">
          <h2 className="text-sm font-semibold text-conflict">
            This memorandum does not match the reconciliation
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            The rule chose one figure and the text printed another. Treat the
            headline below as unverified until this is resolved.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {onePager.adjudication_mismatches.map((m) => (
              <li key={m} className="font-mono text-xs leading-relaxed">
                {m}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Section title="Executive summary">
        <div className="max-w-[68ch] font-display text-[1.02rem] leading-relaxed [&>p+p]:mt-4">
          {onePager.executive_summary
            .split(/\n{2,}/)
            .filter(Boolean)
            .map((para, i) => (
              <p key={i}>{para}</p>
            ))}
        </div>
      </Section>

      <Section title="Company">
        <FieldGrid entries={entriesOf(onePager.company_overview)} />
      </Section>

      <Section title="Financial highlights">
        <p className="mb-2 text-xs text-muted-foreground">
          Actual figures only — audited results from fiscal years that have
          ended. Anything forecast is kept separate, below.
        </p>
        <FieldGrid
          entries={entriesOf(highlights).filter(
            ([label]) => label !== "Projections",
          )}
        />
        {projections ? (
          <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
            <div className="mb-1 flex items-center gap-2">
              <Badge variant="projection">projection</Badge>
            </div>
            <p className="text-sm leading-relaxed">{projections}</p>
          </div>
        ) : null}
      </Section>

      <Section title="Business">
        <FieldGrid entries={entriesOf(onePager.business_metrics)} />
      </Section>

      {onePager.critical_risk_factors?.length ? (
        <Section title="Risks and mitigations">
          <ul className="flex flex-col gap-3">
            {onePager.critical_risk_factors.map((r, i) => (
              <li
                key={i}
                className="border-l-2 border-conflict/50 pl-3 text-sm leading-relaxed"
              >
                <p>{r.risk}</p>
                <p className="mt-1 text-muted-foreground">{r.mitigation}</p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {onePager.key_success_factors?.length ? (
        <Section title="Key success factors">
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed">
            {onePager.key_success_factors.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Transaction">
        <FieldGrid entries={entriesOf(onePager.transaction_structure)} />
      </Section>

      <Section title="Deal rationale">
        <FieldGrid entries={entriesOf(onePager.deal_rationale)} />
      </Section>

      <Section title="Key terms">
        <FieldGrid entries={entriesOf(onePager.key_terms)} />
      </Section>

      <Section title="Summary">
        <FieldGrid entries={entriesOf(onePager.summary_highlights)} />
      </Section>
    </article>
  )
}
