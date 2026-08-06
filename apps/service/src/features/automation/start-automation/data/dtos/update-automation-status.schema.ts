import { z } from "zod"
import { AutomationStatus } from "@/shared/domain/entities/automation.entity"

export const updateAutomationStatusSchema = z.object({
    automationId: z.string().uuid(),
    status: z.nativeEnum(AutomationStatus),
})

export type UpdateAutomationStatusInput = z.infer<
    typeof updateAutomationStatusSchema
>

export interface UpdateAutomationStatusOutput {
    message: string
    automation: {
        id: string
        status: AutomationStatus
    }
}
