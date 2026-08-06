import { Report as PrismaReport } from "@prisma/client"
import { Report, ReportStatus } from "@/shared/domain/entities/report.entity"
import { AgentType } from "@/features/onePager-agent/agent/domain/agent-type"

export class ReportMapper {
    static toDomain(prismaReport: PrismaReport): Report {
        return new Report(
            prismaReport.id,
            prismaReport.automationId,
            prismaReport.companyId,
            prismaReport.domain as AgentType,
            prismaReport.status as ReportStatus,
            prismaReport.reportUrl,
            prismaReport.createdAt,
            prismaReport.updatedAt,
        )
    }

    static toPrisma(
        report: Report,
    ): Omit<PrismaReport, "createdAt" | "updatedAt"> {
        return {
            id: report.getId(),
            automationId: report.getAutomationId(),
            companyId: report.getCompanyId(),
            domain: report.getDomain(),
            status: report.getStatus(),
            reportUrl: report.getReportUrl(),
        }
    }

    static toDomainArray(prismaReports: PrismaReport[]): Report[] {
        return prismaReports.map(this.toDomain)
    }
}
