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
        // Generous on purpose: the uploader has no matching cap, so a limit low
        // enough to hit in practice would orphan every already-uploaded object.
        .max(10000, "Too many files in a single confirm"),
})

export type ConfirmUploadDto = z.infer<typeof ConfirmUploadSchema>
