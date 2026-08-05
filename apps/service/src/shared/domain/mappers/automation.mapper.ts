import { AutomationStage, Automation as PrismaAutomation, Result } from "@prisma/client"
import {
    Automation as DomainAutomation,
    AutomationStatus,
    AutomationStageDomain,
} from "@/shared/domain/entities/automation.entity"

export class AutomationMapper {
    static toDomain(raw: any): DomainAutomation {
        return new DomainAutomation(
            raw.id,
            raw.companyId,
            raw.status as AutomationStatus,
            raw.stage as AutomationStageDomain,
            (raw.results as Result[]) ?? [],
            raw.createdAt,
            raw.updatedAt,
            raw.parentAutomationId || undefined,
        )
    }

    static toPersistence(automation: DomainAutomation): any {
        return {
            id: automation.id,
            companyId: automation.companyId,
            status: automation.status,
            stage: automation.stage,
            createdAt: automation.createdAt,
            updatedAt: automation.updatedAt,
        }
    }

    static toResponse(automation: DomainAutomation) {
        return {
            id: automation.id,
            companyId: automation.companyId,
            status: automation.status,
            stage: automation.stage,
            results: automation.results,
            parentAutomationId: automation.parentAutomationId,
            createdAt: automation.createdAt,
            updatedAt: automation.updatedAt,
        }
    }
}
