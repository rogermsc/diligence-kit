import { Prisma } from "@prisma/client"

export type OverrideTargetType =
    | "FACT"
    | "CONFLICT"
    | "SCORECARD"
    | "ANNOTATION"

export interface AnalysisOverrideRecord {
    id: string
    automationId: string
    targetType: OverrideTargetType
    targetKey: string
    /** Null on an annotation and on a withdrawal. */
    value: unknown
    rationale: string
    authorId: string
    createdAt: Date
}

export interface CreateOverrideData {
    automationId: string
    targetType: OverrideTargetType
    targetKey: string
    value?: Prisma.InputJsonValue
    rationale: string
    authorId: string
}

export interface OverrideRepository {
    /** Appends a row. Nothing in this interface updates or deletes one. */
    create(data: CreateOverrideData): Promise<AnalysisOverrideRecord>

    /** Every row for a run, oldest first — the audit trail as written. */
    listByAutomation(automationId: string): Promise<AnalysisOverrideRecord[]>
}
