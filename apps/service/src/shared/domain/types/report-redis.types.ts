import { AgentType } from "@/features/onePager-agent/agent/domain/agent-type"
import { ReportStatus } from "@/shared/domain/entities/report.entity"

/**
 * Estrutura de um report individual no Redis
 */
export interface RedisReportData {
    id: string
    automationId: string
    companyId: string
    domain: AgentType
    status: ReportStatus
    reportUrl: string
    createdAt: string // ISO string
    updatedAt: string // ISO string
}

/**
 * Estrutura agrupada por automation ID no Redis
 * Key: `automation:reports:{automationId}`
 */
export interface AutomationReportsRedis {
    automationId: string
    companyId: string
    reports: {
        [key in AgentType]?: RedisReportData
    }
    metadata: {
        totalReports: number
        completedReports: number
        untrackedReports: number
        failedReports: number
        lastUpdated: string // ISO string
    }
}

/**
 * Tipo para operações de query no Redis
 */
export interface ReportRedisQuery {
    automationId?: string
    companyId?: string
    domain?: AgentType
    status?: ReportStatus
}

/**
 * Estrutura para índices Redis
 */
export interface ReportRedisIndexes {
    // Key: automation:reports:{automationId}
    byAutomation: Record<string, AutomationReportsRedis>

    // Key: company:reports:{companyId}
    byCompany: Record<string, string[]> // Array de automationIds

    // Key: domain:reports:{domain}
    byDomain: Record<AgentType, string[]> // Array de automationIds

    // Key: status:reports:{status}
    byStatus: Record<ReportStatus, string[]> // Array de reportIds
}

/**
 * Chaves Redis padronizadas
 */
export const REDIS_KEYS = {
    AUTOMATION_REPORTS: (automationId: string) =>
        `automation:reports:${automationId}`,
    COMPANY_REPORTS: (companyId: string) => `company:reports:${companyId}`,
    DOMAIN_REPORTS: (domain: AgentType) => `domain:reports:${domain}`,
    STATUS_REPORTS: (status: ReportStatus) => `status:reports:${status}`,
    REPORT_BY_ID: (reportId: string) => `report:${reportId}`,
} as const

/**
 * Utilitário para criar estrutura de automation reports vazia
 */
export function createEmptyAutomationReports(
    automationId: string,
    companyId: string,
): AutomationReportsRedis {
    return {
        automationId,
        companyId,
        reports: {},
        metadata: {
            totalReports: 0,
            completedReports: 0,
            untrackedReports: 0,
            failedReports: 0,
            lastUpdated: new Date().toISOString(),
        },
    }
}

/**
 * Utilitário para converter Report entity para RedisReportData
 */
export function reportToRedisData(report: {
    getId(): string
    getAutomationId(): string
    getCompanyId(): string
    getDomain(): AgentType
    getStatus(): ReportStatus
    getReportUrl(): string
    getCreatedAt(): Date
    getUpdatedAt(): Date
}): RedisReportData {
    return {
        id: report.getId(),
        automationId: report.getAutomationId(),
        companyId: report.getCompanyId(),
        domain: report.getDomain(),
        status: report.getStatus(),
        reportUrl: report.getReportUrl(),
        createdAt: report.getCreatedAt().toISOString(),
        updatedAt: report.getUpdatedAt().toISOString(),
    }
}

/**
 * Utilitário para atualizar metadata de automation reports
 */
export function updateAutomationReportsMetadata(
    automationReports: AutomationReportsRedis,
): AutomationReportsRedis {
    const reports = Object.values(automationReports.reports)

    return {
        ...automationReports,
        metadata: {
            totalReports: reports.length,
            completedReports: reports.filter(
                (r) => r.status === ReportStatus.COMPLETED,
            ).length,
            untrackedReports: reports.filter(
                (r) => r.status === ReportStatus.UNTRACKED,
            ).length,
            failedReports: reports.filter(
                (r) => r.status === ReportStatus.FAILED,
            ).length,
            lastUpdated: new Date().toISOString(),
        },
    }
}
