import { z } from "zod"

export const OverrideTargetTypeSchema = z.enum([
    "FACT",
    "CONFLICT",
    "SCORECARD",
    "ANNOTATION",
])

/**
 * A fact or conflict field name, or a scorecard category as
 * "category:Financial Readiness". Bounded because it is a map key that ends up
 * in a URL and an index.
 */
export const TargetKeySchema = z
    .string()
    .min(1, "targetKey is required")
    .max(200)

export const CreateOverrideSchema = z
    .object({
        targetType: OverrideTargetTypeSchema,
        targetKey: TargetKeySchema,
        /**
         * The replacement value. Absent for an ANNOTATION, which adds a note
         * without changing anything.
         *
         * Not validated further: what a legitimate value looks like depends on
         * what is being overridden, and this service never reads inside it —
         * the same reasoning as the analysis blob it sits on top of.
         */
        value: z.unknown().optional(),
        /**
         * Required, and not merely present. A one-word rationale is the same
         * unsourced assertion as none at all, so the floor is a sentence.
         */
        rationale: z
            .string()
            .min(10, "Say why — an override without a reason is not judgement")
            .max(5000),
    })
    .superRefine((data, ctx) => {
        if (data.targetType !== "ANNOTATION" && data.value === undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["value"],
                message:
                    "value is required unless targetType is ANNOTATION, which only adds a note",
            })
        }
    })

export type CreateOverrideDto = z.infer<typeof CreateOverrideSchema>

export const RevertOverrideSchema = z.object({
    rationale: z
        .string()
        .min(10, "Say why — withdrawing a decision is also a decision")
        .max(5000),
})

export type RevertOverrideDto = z.infer<typeof RevertOverrideSchema>

export const AutomationIdParamSchema = z.object({
    automationId: z.string().uuid("Invalid automation ID format"),
})

export const RevertParamsSchema = AutomationIdParamSchema.extend({
    targetType: OverrideTargetTypeSchema,
    targetKey: TargetKeySchema,
})
