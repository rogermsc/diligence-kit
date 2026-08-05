import { AutomationStatus } from "@/shared/domain/entities/automation.entity"

interface AutomationData {
    status: AutomationStatus | string
    updatedAt: Date
}

/**
 * Calculate company status based on automation statuses with priority:
 * 1. Processing
 * 2. Pending
 * 3. Failed and Completed (sorted by automation updatedDate)
 */
export class CompanyStatusHelper {
    static calculateStatus(automations: AutomationData[]): AutomationStatus {
        if (!automations || automations.length === 0) {
            return AutomationStatus.PENDING
        }

        // Check for Processing status first (highest priority)
        const hasProcessing = automations.some(
            (automation) => automation.status === AutomationStatus.PROCESSING
        )
        if (hasProcessing) {
            return AutomationStatus.PROCESSING
        }

        // Check for Pending status second priority
        const hasPending = automations.some(
            (automation) => automation.status === AutomationStatus.PENDING
        )
        if (hasPending) {
            return AutomationStatus.PENDING
        }

        // For Failed and Completed, get the most recent one by updatedDate
        const failedAndCompletedAutomations = automations.filter(
            (automation) => 
                automation.status === AutomationStatus.FAILED ||
                automation.status === AutomationStatus.COMPLETED
        )

        if (failedAndCompletedAutomations.length === 0) {
            return AutomationStatus.PENDING
        }

        // Sort by updatedDate descending (most recent first)
        const mostRecent = failedAndCompletedAutomations.sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
        )[0]

        return mostRecent.status as AutomationStatus
    }
} 