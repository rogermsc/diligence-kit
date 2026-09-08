"use client"

import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Analysis, Fact } from "@/domain/analysis/models/analysis"
import { buildEvidenceIndex } from "@/domain/analysis/usecases/evidence"
import { verificationNote } from "@/domain/analysis/usecases/verification"

/**
 * Every fact the run extracted, with the document that states it.
 *
 * `buildEvidenceIndex` was written, tested and imported by nothing. Without it
 * the only facts a reader ever saw were the contested ones — roughly a
 * twentieth of the evidence — so a figure that no document disputed was
 * displayed nowhere and challenged by nothing, however it got there.
 *
 * That matters beyond completeness. Document text reaches the extraction prompt
 * directly, so a planted fact is possible; the pipeline checks every quote
 * against its source, and this is the first screen where that check is visible
 * for a fact that happens not to conflict.
 */

const PROVENANCE: Record<
  string,
  { variant: "actual" | "pro-forma" | "projection" | "unknown"; label: string }
> = {
  actual: { variant: "actual", label: "actual" },
  pro_forma: { variant: "pro-forma", label: "pro-forma" },
  projection: { variant: "projection", label: "projection" },
  "": { variant: "unknown", label: "basis not stated" },
}

/** The checks that can fail on a single fact, named rather than counted. */
function FactFlags({ fact }: { fact: Fact }) {
  const note = verificationNote(fact.quote_verified)
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <span
        className={
          fact.quote_verified === false
            ? "text-conflict"
            : "text-muted-foreground"
        }
      >
        {fact.quote ? note.text : "no quote returned — nothing to check"}
      </span>
      {/* Both of these used to stop at a logger.warning inside the agent. */}
      {fact.cell_verified === false && (
        <span className="text-conflict">
          cites a row that does not hold this figure
        </span>
      )}
      {fact.unit_stated === false && (
        <span className="text-conflict">
          states no unit — scale is ambiguous
        </span>
      )}
    </div>
  )
}

export function EvidenceView({ analysis }: { analysis: Analysis }) {
  const index = useMemo(() => buildEvidenceIndex(analysis), [analysis])
  const [contestedOnly, setContestedOnly] = useState(false)

  const rows = contestedOnly
    ? index.rows.filter((r) => r.contested)
    : index.rows

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-border pt-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          Evidence
        </h2>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={contestedOnly}
            onChange={(e) => setContestedOnly(e.target.checked)}
            className="accent-primary"
          />
          Contested fields only
        </label>
      </div>

      <p className="max-w-[68ch] text-xs leading-relaxed text-muted-foreground">
        <span data-numeric>{index.coveredCount}</span> of{" "}
        <span data-numeric>{index.totalTypes}</span> information types were
        covered by at least one document, across{" "}
        <span data-numeric>{index.sources.length}</span>{" "}
        {index.sources.length === 1 ? "document" : "documents"}. Two documents
        stating the same value corroborate it; two stating different values
        disagree, and stay on separate rows.
      </p>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Field</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Stated by</TableHead>
              <TableHead>Checked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const provenance =
                PROVENANCE[row.facts[0]?.source_type ?? ""] ?? PROVENANCE[""]
              return (
                <TableRow key={`${row.field}-${row.value}`}>
                  <TableCell className="align-top font-mono text-xs">
                    {row.field}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {row.contested && (
                        <Badge variant="conflict">contested</Badge>
                      )}
                      {row.corroborated && (
                        <Badge variant="corroborated">corroborated</Badge>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="align-top">
                    <span className="font-mono" data-numeric>
                      {row.value}
                    </span>
                    <div className="mt-1">
                      <Badge variant={provenance.variant}>
                        {provenance.label}
                      </Badge>
                    </div>
                  </TableCell>

                  <TableCell className="align-top">
                    <ul className="flex flex-col gap-2">
                      {row.facts.map((f, i) => (
                        <li key={i} className="font-mono text-xs">
                          <span className="break-words">{f.source}</span>
                          {f.page && (
                            <span className="text-muted-foreground">
                              {" "}
                              · {f.page}
                            </span>
                          )}
                          {f.quote && (
                            <blockquote className="mt-1 rounded-sm bg-muted/60 p-1.5 leading-relaxed text-foreground/90">
                              {f.quote}
                            </blockquote>
                          )}
                        </li>
                      ))}
                    </ul>
                  </TableCell>

                  <TableCell className="align-top">
                    <div className="flex flex-col gap-2">
                      {row.facts.map((f, i) => (
                        <FactFlags key={i} fact={f} />
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {index.missing.length > 0 && (
        <div className="border-t border-border pt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Not covered by any document
          </h3>
          {/* Absent evidence is evidence. A dataroom with no cap table is a
              finding, and it has no row in the table above to carry it. */}
          <div className="flex flex-wrap gap-1.5">
            {index.missing.map((m) => (
              <Badge key={m} variant="missing">
                {m}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
