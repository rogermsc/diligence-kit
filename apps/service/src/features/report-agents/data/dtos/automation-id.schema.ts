import { z } from "zod"

export const AutomationIdSchema = z.object({
    automationId: z.string().uuid("Invalid automationId format."),
})

export type AutomationIdDto = z.infer<typeof AutomationIdSchema>
