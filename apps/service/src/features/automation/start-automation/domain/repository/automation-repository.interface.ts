import {
    Automation,
    AutomationStageDomain,
    AutomationStatus,
} from "@/shared/domain/entities/automation.entity"

export interface CreateAutomationData {
    id?: string
    companyId: string
    stage: AutomationStageDomain
}

export interface CreateOnePagerData {
    automationId: string
    companyId: string
    url: string
}

export interface AutomationRepository {
    create(data: CreateAutomationData): Promise<Automation>
    findById(id: string): Promise<Automation | null>
    findProcessingByCompanyId(companyId: string): Promise<Automation | null>
    updateStatus(id: string, status: AutomationStatus): Promise<void>
    /**
     * Marks a still-processing run as alive. Returns false when it matched
     * nothing, which is the normal outcome for a run that already finished.
     */
    recordHeartbeat(id: string): Promise<boolean>
    getCompanyIdByAutomationId(automationId: string): Promise<string | null>
    createOrUpdateOnePager(data: CreateOnePagerData): Promise<void>
    findOnePagerByAutomationId(
        automationId: string,
    ): Promise<{ id: string; url: string } | null>
    findLatestOnePagerByCompanyId(
        companyId: string,
    ): Promise<{ id: string; url: string } | null>
}
