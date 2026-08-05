import { z } from "zod"

/**
 * Shape validation for POST /automation/:automationId/confirm.
 *
 * gcsPath is only checked for shape here — it is additionally pinned to this
 * automation's own upload prefix in ConfirmUploadUseCase, which is where the
 * company name needed to build that prefix is available.
 */
export const ConfirmUploadSchema = z.object({
    companyId: z.string().uuid("Invalid company ID format"),
    files: z
        .array(
            z.object({
                fileName: z.string().min(1).max(512),
                gcsPath: z
                    .string()
                    .min(1)
                    .max(2048)
                    .startsWith("gs://", "Upload path must be a gs:// URI"),
            }),
        )
        .min(1, "At least one file is required")
        .max(500, "Too many files in a single confirm"),
})

export type ConfirmUploadDto = z.infer<typeof ConfirmUploadSchema>
