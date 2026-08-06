import { Injectable, Logger } from "@nestjs/common"
import { Report } from "@/shared/domain/entities/report.entity"
import {
    CreateReportData,
    ReportRepository,
} from "@/shared/repository/report-repository.interface"
import { DatabaseAccessError } from "@/shared/errors/db/data-base-error"
import {
    ReportCreationFailedError,
    ReportUpdateFailedError,
    ReportNotFoundError,
    ExpiredReportsCleanupFailedError,
} from "@/shared/errors/report-errors"
import { prisma } from "@/shared/infra/prisma"
import { ReportMapper } from "@/shared/domain/mappers/report.mapper"
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library"
import { AgentType } from "@/features/onePager-agent/agent/domain/agent-type"

@Injectable()
export class PrismaReportRepositoryAdapter implements ReportRepository {
    private readonly logger = new Logger(PrismaReportRepositoryAdapter.name)

    async createOrUpdate(data: CreateReportData): Promise<Report> {
        try {
            // Buscar a automation para obter o companyId
            const automation = await prisma.automation.findUnique({
                where: { id: data.automationId },
                select: { companyId: true },
            })

            if (!automation) {
                throw new ReportCreationFailedError()
            }

            const report = await prisma.report.upsert({
                where: {
                    unique_automation_domain: {
                        automationId: data.automationId,
                        domain: data.domain,
                    },
                },
                update: {
                    reportUrl: data.reportUrl,
                    status: "COMPLETED",
                    updatedAt: new Date(),
                },
                create: {
                    automationId: data.automationId,
                    companyId: automation.companyId,
                    domain: data.domain,
                    reportUrl: data.reportUrl,
                    status: "COMPLETED",
                },
            })

            return ReportMapper.toDomain(report)
        } catch (error) {
            this.handleReportOperationError(
                error,
                data.automationId,
                data.domain,
                "create/update",
            )
        }
    }

    async findByAutomationId(automationId: string): Promise<Report[]> {
        try {
            const reports = await prisma.report.findMany({
                where: { automationId },
                orderBy: { createdAt: "asc" },
            })

            return ReportMapper.toDomainArray(reports)
        } catch (error) {
            this.handleReportFindError(error, automationId)
        }
    }

    async findByAutomationIdAndDomain(
        automationId: string,
        domain: AgentType,
    ): Promise<Report | null> {
        try {
            const report = await prisma.report.findUnique({
                where: {
                    unique_automation_domain: {
                        automationId,
                        domain,
                    },
                },
            })

            return report ? ReportMapper.toDomain(report) : null
        } catch (error) {
            this.handleReportFindError(error, automationId, domain)
        }
    }

    async countByAutomationId(automationId: string): Promise<number> {
        try {
            return await prisma.report.count({
                where: { automationId },
            })
        } catch (error) {
            this.handleReportFindError(error, automationId)
        }
    }

    async hasAllAgentReports(automationId: string): Promise<boolean> {
        try {
            const count = await this.countByAutomationId(automationId)
            return count >= 4 // All four agent types: OPERATIONAL, COMMERCIAL, FINANCIAL, CAP_TABLE_AND_LEGAL_REVIEW
        } catch (error) {
            this.handleReportFindError(error, automationId)
        }
    }

    async deleteExpiredReports(daysOld: number = 7): Promise<number> {
        try {
            const expirationDate = new Date()
            expirationDate.setDate(expirationDate.getDate() - daysOld)

            const result = await prisma.report.deleteMany({
                where: {
                    createdAt: {
                        lt: expirationDate,
                    },
                },
            })

            this.logger.log(
                `Deleted ${result.count} expired reports older than ${daysOld} days`,
            )
            return result.count
        } catch (error) {
            this.handleExpiredReportsCleanupError(error, daysOld)
        }
    }

    private handleReportOperationError(
        error: any,
        automationId: string,
        domain: AgentType,
        operation: string,
    ): never {
        if (error instanceof PrismaClientKnownRequestError) {
            this.logger.error(
                `Prisma error during report ${operation} for automation ${automationId} and domain ${domain}: ${error.message} `,
                error.stack,
            )

            if (operation === "create/update") {
                throw new ReportCreationFailedError()
            } else {
                throw new ReportUpdateFailedError(
                    automationId,
                    domain,
                    error.message,
                )
            }
        }

        this.logger.error(
            `Failed to ${operation} report for automation ${automationId} and domain ${domain}: ${error.message} `,
            error.stack,
        )

        if (operation === "create/update") {
            throw new ReportCreationFailedError()
        } else {
            throw new ReportUpdateFailedError(
                automationId,
                domain,
                error.message,
            )
        }
    }

    private handleReportFindError(
        error: any,
        automationId: string,
        domain?: AgentType,
    ): never {
        if (error instanceof PrismaClientKnownRequestError) {
            this.logger.error(
                `Prisma error finding reports for automation ${automationId}${domain ? ` and domain ${domain}` : ""}: ${error.message} `,
                error.stack,
            )
        } else {
            this.logger.error(
                `Failed to find reports for automation ${automationId}${domain ? ` and domain ${domain}` : ""}: ${error.message} `,
                error.stack,
            )
        }

        // For find operations, we throw a generic database error since not finding reports is not always an error
        throw new DatabaseAccessError(
            `Failed to retrieve reports for automation ${automationId}`,
        )
    }

    private handleExpiredReportsCleanupError(
        error: any,
        daysOld: number,
    ): never {
        if (error instanceof PrismaClientKnownRequestError) {
            this.logger.error(
                `Prisma error during expired reports cleanup(${daysOld} days old): ${error.message} `,
                error.stack,
            )
            throw new ExpiredReportsCleanupFailedError(error.message)
        }

        this.logger.error(
            `Failed to cleanup expired reports(${daysOld} days old): ${error.message} `,
            error.stack,
        )
        throw new ExpiredReportsCleanupFailedError(error.message)
    }
}
