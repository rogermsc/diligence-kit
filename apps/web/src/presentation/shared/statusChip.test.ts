import { describe, expect, it } from "vitest"

import { CompanyStatus } from "@/domain/companies/models/company"
import { formatDate } from "@/lib/formatDate"
import { statusDot, statusLabel } from "@/presentation/shared/statusChip"

describe("statusChip", () => {
  it("has a label and a colour for every status the domain defines", () => {
    // The point of collapsing the two copies of this switch. If someone adds a
    // status to the enum, this fails rather than that status rendering as a
    // grey dot with a raw enum name next to it on one screen only.
    for (const status of Object.values(CompanyStatus)) {
      expect(statusLabel(status), status).not.toBe(status)
      expect(statusDot(status), status).not.toBe("bg-muted-foreground")
    }
  })

  it("falls back rather than throwing on a status from an older API", () => {
    const unknown = "ARCHIVED" as CompanyStatus
    expect(statusLabel(unknown)).toBe("ARCHIVED")
    expect(statusDot(unknown)).toBe("bg-muted-foreground")
  })
})

describe("formatDate", () => {
  it("renders an ISO timestamp in the one pinned format", () => {
    // Pinned to en-US on purpose: this also renders on the server, and a
    // locale-dependent string is a hydration mismatch.
    expect(formatDate("2024-12-31T09:05:00.000Z")).toMatch(
      /December 31, 2024 at |December 31, 2024, /,
    )
  })

  it("does not print Invalid Date at the user", () => {
    expect(formatDate("not a date")).toBe("—")
  })
})
