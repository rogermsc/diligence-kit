import { Check } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type {
  ConflictCase as Case,
  ConflictValue,
} from "@/domain/analysis/usecases/conflicts"
import { locateValueInQuote } from "@/domain/analysis/usecases/evidence"
import { verificationNote } from "@/domain/analysis/usecases/verification"
import { cn } from "@/lib/utils"

const PROVENANCE: Record<string, { variant: "actual" | "pro-forma" | "projection" | "unknown"; label: string }> = {
  actual: { variant: "actual", label: "actual" },
  pro_forma: { variant: "pro-forma", label: "pro-forma" },
  projection: { variant: "projection", label: "projection" },
  "": { variant: "unknown", label: "basis not stated" },
}

const BASIS_LABEL: Record<string, string> = {
  source_type: "basis of preparation",
  document_authority: "document authority",
  recency: "recency",
  unresolved: "unresolved",
}

/** The quote, with the extracted value marked only where it literally occurs. */
function Quote({ value, quote }: { value: string; quote: string }) {
  const hit = locateValueInQuote(value, quote)
  if (!hit) {
    return <span>{quote}</span>
  }
  return (
    <>
      {quote.slice(0, hit.start)}
      <mark className="bg-accent/25 text-foreground">
        {quote.slice(hit.start, hit.end)}
      </mark>
      {quote.slice(hit.end)}
    </>
  )
}

/**
 * All three states, always stated. Never absence.
 *
 * This used to warn on `false` and print nothing otherwise, which gave `true`
 * and `null` the same appearance — so a quote from a scan, which nobody could
 * check, looked exactly like one checked and found. The agent keeps those
 * apart on purpose (`verify()` returns `None`, never `False`, when there is no
 * text to read); silence here spent that distinction in the flattering
 * direction.
 */
function VerificationNote({ verified }: { verified: boolean | null }) {
  const note = verificationNote(verified)
  return (
    <span
      className={cn(
        "mt-1 block",
        note.tone === "conflict" ? "text-conflict" : "text-muted-foreground",
      )}
    >
      {note.text}
    </span>
  )
}


function ValueColumn({ value, resolved }: { value: ConflictValue; resolved: boolean }) {
  const provenance = PROVENANCE[value.sourceType] ?? PROVENANCE[""]

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 border-t-2 pt-3",
        // Losers are not greyed out. They are not wrong — they are prepared on
        // a different basis, and dimming them would say otherwise.
        value.preferred ? "border-t-primary" : "border-t-border",
      )}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-lg font-medium" data-numeric>
          {value.value}
        </span>
        {value.preferred && (
          <Check className="h-4 w-4 shrink-0 text-primary" aria-label="preferred" />
        )}
      </div>

      <Badge variant={provenance.variant} className="w-fit">
        {provenance.label}
      </Badge>

      <div className="space-y-0.5 text-xs text-muted-foreground">
        <p className="break-words font-mono">{value.source}</p>
        <p className="font-mono">
          {value.page && `p. ${value.page}`}
          {value.documentDate && ` · ${value.documentDate}`}
          {value.documentVersion && ` · ${value.documentVersion}`}
        </p>
      </div>

      {value.quote && (
        <blockquote className="rounded-sm bg-muted/60 p-2 font-mono text-xs leading-relaxed text-foreground/90">
          <Quote value={value.value} quote={value.quote} />
          <VerificationNote verified={value.quoteVerified} />
        </blockquote>
      )}

      {!resolved && (
        <p className="text-xs text-muted-foreground">carried forward</p>
      )}
    </div>
  )
}

export function ConflictCase({ conflictCase }: { conflictCase: Case }) {
  const { field, values, resolved, magnitude } = conflictCase

  return (
    <article className="rounded-md border border-border bg-card">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 px-4 py-3">
        <h2 className="font-mono text-sm font-medium">{field}</h2>
        <Badge variant={resolved ? "actual" : "conflict"}>
          {resolved ? "resolved" : "unresolved"}
        </Badge>
      </header>

      <div className="px-4 py-4">
        <p className="mb-4 text-sm text-muted-foreground">
          {values.length} documents state this differently
          {magnitude && (
            <>
              {" — "}
              <span className="text-conflict" data-numeric>
                {magnitude}
              </span>
            </>
          )}
          .
        </p>

        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${Math.min(values.length, 3)}, minmax(0, 1fr))`,
          }}
        >
          {values.map((value) => (
            <ValueColumn
              key={`${value.source}-${value.value}`}
              value={value}
              resolved={resolved}
            />
          ))}
        </div>
      </div>

      <footer className="border-t border-border/60 bg-muted/30 px-4 py-3">
        {resolved ? (
          <>
            <p className="text-sm">
              <span className="text-muted-foreground">Why </span>
              <span className="font-mono font-medium">
                {conflictCase.preferredValue}
              </span>
              <span className="text-muted-foreground"> won</span>
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              <span className="uppercase tracking-wide">
                {BASIS_LABEL[conflictCase.basis] ?? conflictCase.basis}
              </span>
              {" — "}
              {conflictCase.rationale}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Confidence{" "}
              <span data-numeric>{conflictCase.confidence.toFixed(1)}</span>
              {" · rule defined in "}
              <span className="font-mono">domain/analyze/authority.py</span>
            </p>
          </>
        ) : (
          // The one thing this screen must never do is manufacture a winner.
          <>
            <p className="text-sm text-conflict">No rule separated these.</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {conflictCase.rationale ||
                "They share a basis of preparation, no document outranks the others, and none is more recent."}{" "}
              Every value is carried into the memorandum and flagged.
            </p>
          </>
        )}
      </footer>
    </article>
  )
}
