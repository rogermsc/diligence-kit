import { z } from "zod"

export const uploadZipDataroomSchema = z.object({
    enterpriseId: z.string().uuid("Enterprise ID must be a valid UUID"),
    file: z.object({
        originalname: z.string(),
        mimetype: z
            .string()
            .refine(
                (mime) =>
                    [
                        "application/zip",
                        "application/x-zip-compressed",
                        "multipart/x-zip",
                    ].includes(mime),
                "File must be a valid ZIP",
            ),
        size: z.number().positive("File must have a size greater than zero"),
        buffer: z.instanceof(Buffer),
    }),
})

export type UploadZipDataroomInput = z.infer<typeof uploadZipDataroomSchema>
