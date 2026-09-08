import { z } from "zod"
import { AgentType } from "@/features/onePager-agent/agent/domain/agent-type"
import { ReportStatus } from "@/shared/domain/entities/report.entity"

// Enum values for validation
const AgentTypeEnum = z.nativeEnum(AgentType)
const ReportStatusEnum = z.nativeEnum(ReportStatus)

/**
 * The same envelope the one-pager posts back, carrying the domain report.
 *
 * Shape only, and passthrough — the backend stores this and serves it back
 * without reading inside it, so validating the interior here would mean a
 * second copy of the agent's entities kept in lockstep across two languages
 * for no reader's benefit.
 *
 * Optional, because the column existed before the agent sent anything to put
 * in it and runs recorded in between have none.
 */
const reportAnalysisSchema = z
    .object({
        version: z.literal(1),
        facts: z.record(z.array(z.unknown())),
        coverage: z.record(z.array(z.string())),
        missing: z.array(z.string()),
        conflicts: z.array(z.unknown()),
        report: z.record(z.unknown()),
    })
    .passthrough()

export const reportPayloadSchema = z.object({
    automationId: z.string().uuid("Automation ID must be a valid UUID"),
    reportUrl: z.string().url("Report URL must be a valid URL").optional(),
    domain: AgentTypeEnum,
    status: ReportStatusEnum,
    analysis: reportAnalysisSchema.optional(),
})

export type ReportPayloadSchema = z.infer<typeof reportPayloadSchema>
