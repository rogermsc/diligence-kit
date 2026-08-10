import { z } from "zod"

const PRIVATE_HOST_PATTERNS = [
    /^localhost$/i,
    /^127\./,
    /^0\.0\.0\.0$/,
    /^::1$/,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
]

/**
 * Structural only, on purpose.
 *
 * This service never reads inside the blob — it stores it and serves it back —
 * so deep-validating it would mean a second copy of the agent's pydantic models
 * here, maintained in lockstep, checking nothing this service depends on.
 *
 * `version` is the part that matters. Pinning it means an agent that changes
 * the shape without a coordinated deploy fails this callback loudly, instead of
 * writing something the frontend cannot read.
 *
 * ponytail: shallow. Deepen it the day this service reads a field out of it.
 */
export const analysisSchema = z
    .object({
        version: z.literal(1),
        facts: z.record(z.array(z.unknown())),
        coverage: z.record(z.array(z.string())),
        missing: z.array(z.string()),
        conflicts: z.array(z.unknown()),
        one_pager: z.record(z.unknown()),
    })
    .passthrough()

export const completeOnePagerSchema = z.object({
    onePagerUrl: z
        .string()
        .url("OnePager URL must be a valid URL")
        .refine((url) => {
            try {
                const { hostname } = new URL(url)
                return !PRIVATE_HOST_PATTERNS.some((pattern) =>
                    pattern.test(hostname),
                )
            } catch {
                return false
            }
        }, "URL must not point to private or internal addresses"),
    coverage: z.array(z.string()).optional(),
    missing: z.array(z.string()).optional(),
    // Optional so an agent deployed before this still completes its runs.
    analysis: analysisSchema.optional(),
})

export type CompleteOnePagerRequest = z.infer<typeof completeOnePagerSchema>
