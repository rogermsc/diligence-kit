import { CompanyStatus } from "@/domain/companies/models/company"
import { cn } from "@/lib/utils"

/**
 * One definition of what a run's status looks like.
 *
 * The same switch over CompanyStatus — the same four colours, the same four
 * labels — was written out twice, in companiesView and companyDetailView. Two
 * copies of a mapping is how a status ends up green on one screen and grey on
 * the next.
 */
const STATUS: Record<CompanyStatus, { label: string; dot: string }> = {
  [CompanyStatus.PENDING]: { label: "Pending", dot: "bg-missing" },
  [CompanyStatus.PROCESSING]: { label: "Processing", dot: "bg-primary" },
  [CompanyStatus.COMPLETED]: { label: "Completed", dot: "bg-evidence-actual" },
  [CompanyStatus.FAILED]: { label: "Failed", dot: "bg-destructive" },
}

export function statusLabel(status: CompanyStatus): string {
  return STATUS[status]?.label ?? status
}

export function statusDot(status: CompanyStatus): string {
  return STATUS[status]?.dot ?? "bg-muted-foreground"
}

export function StatusChip({
  status,
  className,
}: {
  status: CompanyStatus
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs", className)}>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", statusDot(status))} />
      {statusLabel(status)}
    </span>
  )
}
