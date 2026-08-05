import { z } from "zod"

export const CompanyIdSchema = z.object({
    id: z.string().uuid("Invalid UUID"),
})

export type CompanyIdDto = z.infer<typeof CompanyIdSchema>
