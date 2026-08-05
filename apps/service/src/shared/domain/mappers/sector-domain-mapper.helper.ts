import { AgentType } from '@prisma/client'
import { AutomationStageDomain } from '@/shared/domain/entities/automation.entity'

export class SectorDomainMapperHelper {
    /**
     * Maps output document sector to corresponding agent domain type
     */
    static mapSectorToDomain(sector: string): AgentType {
        const sectorDomainMapping: Record<string, AgentType> = {
            FINANCIAL: AgentType.FINANCIAL,
            LEGAL: AgentType.CAP_TABLE_AND_LEGAL_REVIEW,
            CORPORATE: AgentType.CAP_TABLE_AND_LEGAL_REVIEW,
            CLIENTS: AgentType.COMMERCIAL,
            INVESTMENT: AgentType.COMMERCIAL,
            COMPANY_SUMMARY: AgentType.OPERATIONAL,
            TEAM: AgentType.OPERATIONAL,
        }

        return sectorDomainMapping[sector] || AgentType.OPERATIONAL
    }


    static mapDomainToStage(domain: AgentType): AutomationStageDomain {
        const domainStageMapping: Record<AgentType, AutomationStageDomain> = {
                    [AgentType.FINANCIAL]: AutomationStageDomain.DILLIGENCE_FINANCIAL,
        [AgentType.CAP_TABLE_AND_LEGAL_REVIEW]: AutomationStageDomain.DILLIGENCE_CAP_TABLE_AND_LEGAL_REVIEW,
        [AgentType.COMMERCIAL]: AutomationStageDomain.DILLIGENCE_COMMERCIAL,
        [AgentType.OPERATIONAL]: AutomationStageDomain.DILLIGENCE_OPERATIONAL,
        }

        return domainStageMapping[domain]
    }


    static getAllDiligenceDomains(): AgentType[] {
        return [
            AgentType.OPERATIONAL,
            AgentType.COMMERCIAL,
            AgentType.FINANCIAL,
            AgentType.CAP_TABLE_AND_LEGAL_REVIEW,
        ]
    }
}