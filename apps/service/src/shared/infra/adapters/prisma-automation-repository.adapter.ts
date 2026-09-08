import { Injectable, Logger } from "@nestjs/common"
import { randomUUID } from "crypto"

import { Automation } from "@/shared/domain/entities/automation.entity"
import { AutomationStatus, AgentType, Prisma } from "@prisma/client"
import { prisma } from "@/shared/infra/prisma"
import { AutomationMapper } from "@/shared/domain/mappers/automation.mapper"
import { DatabaseAccessError } from "@/shared/errors/db/data-base-error"
import { AutomationStageDomain } from "@/shared/domain/entities/automation.entity"
import {
    IAutomationRepository,
    CreateAutomationData,
    CreateDiligenceAutomationData,
    UpdateAutomationWithReportData,
} from "@/shared/repository/automation-repository.interface"
import { Report } from "@/shared/domain/entities/report.entity"
import { ReportMapper } from "@/shared/domain/mappers/report.mapper"

@Injectable()
export class PrismaAutomationRepositoryAdapter implements IAutomationRepository {
    private readonly logger = new Logger(PrismaAutomationRepositoryAdapter.name)

    async recordHeartbeat(id: string): Promise<boolean> {
        // Scoped to PROCESSING so a late ping cannot revive a run the reaper has
        // already failed or the agent has already completed.
        const { count } = await prisma.automation.updateMany({
            where: { id, status: "PROCESSING" },
            data: { heartbeatAt: new Date() },
        })
        return count > 0
    }

    async create(data: CreateAutomationData): Promise<Automation> {
        try {
            const automationId = data.id || randomUUID()

            this.logger.debug("Creating automation", {
                providedId: data.id,
                generatedId: automationId,
                companyId: data.companyId,
            })

            const automation = await prisma.automation.create({
                data: {
                    id: automationId,
                    companyId: data.companyId,
                    status: data.status,
                },
                include: { results: true },
            })
            return AutomationMapper.toDomain(automation)
        } catch (error) {
            this.logger.error(
                `Failed to create automation: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError("Failed to create automation")
        }
    }

    async findById(id: string): Promise<Automation | null> {
        try {
            const automation = await prisma.automation.findUnique({
                where: { id },
                include: { results: true },
            })
            if (!automation) return null
            return AutomationMapper.toDomain(automation)
        } catch (error) {
            this.logger.error(
                `Failed to find automation by ID ${id}: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError("Failed to find automation by ID")
        }
    }

    async findProcessingByCompanyId(
        companyId: string,
    ): Promise<Automation | null> {
        try {
            const automation = await prisma.automation.findFirst({
                where: {
                    companyId,
                    status: {
                        in: [
                            AutomationStatus.PENDING,
                            AutomationStatus.PROCESSING,
                        ],
                    },
                },
                orderBy: { createdAt: "desc" },
                include: { results: true },
            })
            if (!automation) return null
            return AutomationMapper.toDomain(automation)
        } catch (error) {
            this.logger.error(
                `Failed to find processing automation for company ${companyId}: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError(
                "Failed to find processing automation for company",
            )
        }
    }

    /**
     * Fail a run that has not already finished, and say why.
     *
     * Scoped for the same reason recordHeartbeat is: a failure callback used to
     * be applied unconditionally, so replaying a captured
     * complete-onepager-error demoted a COMPLETED automation to FAILED and
     * discarded a good run from the screen. Signed timestamps now make that
     * replay hard; this makes it harmless.
     *
     * Returns whether it applied, so a caller can tell "marked failed" from
     * "arrived after the run had already completed" instead of assuming.
     */
    async markFailed(id: string, reason: string): Promise<boolean> {
        try {
            const { count } = await prisma.automation.updateMany({
                where: { id, status: { notIn: ["COMPLETED", "FAILED"] } },
                data: { status: "FAILED", failureReason: reason },
            })
            if (count === 0) {
                this.logger.warn(
                    `Ignored a failure for automation ${id}: it is already in a terminal state. Reason offered: ${reason}`,
                )
            }
            return count > 0
        } catch (error) {
            const cause = error as Error
            this.logger.error(
                `Failed to mark automation ${id} as failed: ${cause.message}`,
                cause.stack,
            )
            throw new DatabaseAccessError("Failed to mark automation as failed")
        }
    }

    /**
     * Remove a set of automations, used only to clear a stage-2 run whose every
     * child failed so it can be started again.
     *
     * Scoped to FAILED in the query as well as by the caller: a delete that
     * trusts its argument is one bad id away from removing a run someone is
     * still reading.
     */
    async deleteMany(ids: string[]): Promise<number> {
        if (ids.length === 0) return 0
        try {
            const { count } = await prisma.automation.deleteMany({
                where: { id: { in: ids }, status: "FAILED" },
            })
            return count
        } catch (error) {
            const cause = error as Error
            this.logger.error(
                `Failed to delete automations ${ids.join(", ")}: ${cause.message}`,
                cause.stack,
            )
            throw new DatabaseAccessError("Failed to delete automations")
        }
    }

    async updateStatus(id: string, status: AutomationStatus): Promise<void> {
        try {
            await prisma.automation.update({
                where: { id },
                data: { status },
            })
        } catch (error) {
            this.logger.error(
                `Failed to update automation status for ${id}: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError("Failed to update automation status")
        }
    }

    async updateAutomationWithReport(
        data: UpdateAutomationWithReportData,
    ): Promise<Report | null> {
        try {
            return await prisma.$transaction(async (tx) => {
                await tx.automation.update({
                    where: { id: data.automationId },
                    data: {
                        status: data.automationStatus,
                        updatedAt: new Date(),
                    },
                })

                if (data.reportData) {
                    const reportData = await tx.report.upsert({
                        where: {
                            unique_automation_domain: {
                                automationId: data.automationId,
                                domain: data.reportData.domain,
                            },
                        },
                        update: {
                            reportUrl: data.reportData.reportUrl,
                            status: "COMPLETED",
                            // The column the migration described as "written
                            // now, read later". Until this, never written.
                            analysis: data.reportData
                                .analysis as Prisma.InputJsonValue,
                            updatedAt: new Date(),
                        },
                        create: {
                            automationId: data.automationId,
                            companyId: data.reportData.companyId,
                            domain: data.reportData.domain,
                            reportUrl: data.reportData.reportUrl,
                            analysis: data.reportData
                                .analysis as Prisma.InputJsonValue,
                            status: "COMPLETED",
                        },
                    })

                    return ReportMapper.toDomain(reportData)
                }

                return null
            })
        } catch (error) {
            this.logger.error(
                `Failed to update automation with report for ${data.automationId}: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError(
                "Failed to update automation with report",
            )
        }
    }

    // Extended method for report-agents: create multiple diligence automations inside optional tx
    async createMany(
        data: CreateDiligenceAutomationData[],
        tx?: any,
    ): Promise<Automation[]> {
        try {
            const client = (tx || prisma) as typeof prisma
            const created = await Promise.all(
                data.map(async (d) => {
                    const automation = await client.automation.create({
                        data: {
                            id: d.id || undefined,
                            companyId: d.companyId,
                            status: d.status || AutomationStatus.PENDING,
                            stage: d.stage,
                            parentAutomationId: d.parentAutomationId,
                        },
                        include: { results: true },
                    })
                    return AutomationMapper.toDomain(automation)
                }),
            )
            return created
        } catch (error) {
            this.logger.error(
                `Failed to create many automations: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError("Failed to create many automations")
        }
    }

    // Extended method for report-agents: find automation by ID only if it's TRIAGE and COMPLETED
    async findTriageCompletedById(id: string): Promise<Automation | null> {
        try {
            const automation = await prisma.automation.findUnique({
                where: {
                    id,
                    stage: AutomationStageDomain.TRIAGE,
                    status: AutomationStatus.COMPLETED,
                },
                include: { results: true },
            })
            if (!automation) return null
            return AutomationMapper.toDomain(automation)
        } catch (error) {
            this.logger.error(
                `Failed to find TRIAGE completed automation by ID ${id}: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError(
                "Failed to find TRIAGE completed automation by ID",
            )
        }
    }

    // Method to find child automations by parent automation ID
    async findByParentAutomationId(
        parentAutomationId: string,
    ): Promise<Automation[]> {
        try {
            const automations = await prisma.automation.findMany({
                where: {
                    parentAutomationId,
                },
                include: { results: true },
            })
            return automations.map((automation) =>
                AutomationMapper.toDomain(automation),
            )
        } catch (error) {
            this.logger.error(
                `Failed to find automations by parent ID ${parentAutomationId}: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError(
                "Failed to find automations by parent ID",
            )
        }
    }

    async updateState(
        id: string,
        data: {
            status?: AutomationStatus
            parentAutomationId?: string | null
            domain?: AgentType | null
        },
    ): Promise<void> {
        try {
            await prisma.automation.update({
                where: { id },
                data: {
                    ...(data.status ? { status: data.status } : {}),
                    ...(data.parentAutomationId !== undefined
                        ? { parentAutomationId: data.parentAutomationId }
                        : {}),
                    ...(data.domain !== undefined
                        ? { domain: data.domain }
                        : {}),
                },
            })
        } catch (error) {
            this.logger.error(
                `Failed to update automation state for ${id}: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError("Failed to update automation state")
        }
    }

    async getCompanyIdByAutomationId(
        automationId: string,
    ): Promise<string | null> {
        try {
            const automation = await prisma.automation.findUnique({
                where: { id: automationId },
                select: { companyId: true },
            })

            return automation?.companyId || null
        } catch (error) {
            this.logger.error(
                `Failed to get company ID for automation ${automationId}: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError(
                "Failed to get company ID by automation ID",
            )
        }
    }

    async createOrUpdateOnePager(data: {
        automationId: string
        companyId: string
        url: string
        analysis?: Prisma.InputJsonValue
    }): Promise<void> {
        try {
            const existingOnePager = await prisma.onePager.findFirst({
                where: { automationId: data.automationId },
            })

            if (existingOnePager) {
                await prisma.onePager.update({
                    where: { id: existingOnePager.id },
                    data: {
                        url: data.url,
                        companyId: data.companyId,
                        // Prisma skips `undefined`, so a callback from an older
                        // agent updates the URL and leaves a good blob alone
                        // rather than wiping it.
                        analysis: data.analysis,
                        updatedAt: new Date(),
                    },
                })
            } else {
                await prisma.onePager.create({
                    data: {
                        automationId: data.automationId,
                        companyId: data.companyId,
                        url: data.url,
                        analysis: data.analysis,
                    },
                })
            }
        } catch (error) {
            this.logger.error(
                `Failed to create or update OnePager for automation ${data.automationId}: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError("Failed to create or update OnePager")
        }
    }

    async findOnePagerByAutomationId(
        automationId: string,
    ): Promise<{ id: string; url: string; analysis: unknown } | null> {
        try {
            const onePager = await prisma.onePager.findFirst({
                where: { automationId },
                select: { id: true, url: true, analysis: true },
            })

            return onePager
        } catch (error) {
            this.logger.error(
                `Failed to find OnePager for automation ${automationId}: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError(
                "Failed to find OnePager by automation ID",
            )
        }
    }
}
