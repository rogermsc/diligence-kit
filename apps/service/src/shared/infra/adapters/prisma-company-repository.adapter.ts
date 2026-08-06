import { Injectable, Logger } from "@nestjs/common"
import { Company } from "@/shared/domain/entities/company.entity"
import {
    CompanyRepository,
    CreateCompanyData,
    UpdateCompanyData,
    CompanyWithAutomations,
} from "@/shared/repository/company-repository.interface"
import {
    DatabaseAccessError,
    InvalidUUIDError,
    RecordNotFoundError,
} from "@/shared/errors/db/data-base-error"
import { prisma } from "@/shared/infra/prisma"
import { CompanyMapper } from "@/shared/domain/mappers/company.mapper"

/**
 * Prisma reads `undefined` in a `where` clause as "no filter". On deleteMany that
 * turns `{ id: undefined, ownerId }` into "delete every company this user owns",
 * which reports success because count > 0. Never let an absent id reach a query.
 */
function requireId(value: string, field: string): string {
    if (typeof value !== "string" || value.length === 0) {
        throw new RecordNotFoundError(`${field} (missing)`)
    }
    return value
}

@Injectable()
export class PrismaCompanyRepositoryAdapter implements CompanyRepository {
    private readonly logger = new Logger(PrismaCompanyRepositoryAdapter.name)

    async create(data: CreateCompanyData): Promise<Company> {
        try {
            const company = await prisma.company.create({
                data: {
                    name: data.name,
                    ownerId: data.ownerId,
                },
            })

            return CompanyMapper.toDomain(company)
        } catch (error) {
            this.logger.error(
                `Failed to create company: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError(`Failed to create company`)
        }
    }

    async findById(id: string, ownerId: string): Promise<Company | null> {
        try {
            const company = await prisma.company.findFirst({
                where: { id: requireId(id, "id"), ownerId: requireId(ownerId, "ownerId") },
            })

            if (!company) {
                return null
            }

            return CompanyMapper.toDomain(company)
        } catch (error) {
            if (error.message && error.message.includes("invalid character")) {
                this.logger.error(
                    `Invalid UUID format provided: ${id}`,
                    error.stack,
                )
                throw new InvalidUUIDError(id)
            }

            this.logger.error(
                `Failed to find company by ID ${id}: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError(`Failed to find company by ID`)
        }
    }

    async findByIdAsSystem(id: string): Promise<Company | null> {
        try {
            const company = await prisma.company.findUnique({ where: { id } })

            return company ? CompanyMapper.toDomain(company) : null
        } catch (error) {
            if (error.message && error.message.includes("invalid character")) {
                throw new InvalidUUIDError(id)
            }

            this.logger.error(
                `Failed to find company by ID ${id}: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError(`Failed to find company by ID`)
        }
    }

    async findByNameAsSystem(name: string): Promise<Company | null> {
        try {
            const company = await prisma.company.findFirst({ where: { name } })

            return company ? CompanyMapper.toDomain(company) : null
        } catch (error) {
            this.logger.error(
                `Failed to find company by name: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError(`Failed to find company by name`)
        }
    }

    async findByIdWithAutomations(
        id: string,
        ownerId: string,
    ): Promise<CompanyWithAutomations | null> {
        try {
            const companyWithAutomations = await prisma.company.findFirst({
                where: { id: requireId(id, "id"), ownerId: requireId(ownerId, "ownerId") },
                include: {
                    automations: {
                        orderBy: { createdAt: "desc" },
                        include: {
                            results: {
                                orderBy: { createdAt: "desc" },
                                take: 1,
                                include: {
                                    documents: {
                                        include: {
                                            document: true,
                                        },
                                    },
                                },
                            },
                            Documents: true,
                            reports: {
                                orderBy: { createdAt: "desc" },
                            },
                            onePagers: {
                                orderBy: { createdAt: "desc" },
                                take: 1,
                                select: { url: true },
                            },
                        },
                    },
                },
            })

            if (!companyWithAutomations) {
                return null
            }

            const company = CompanyMapper.toDomain(companyWithAutomations)
            const automations = companyWithAutomations.automations.map(
                (automation) => ({
                    id: automation.id,
                    companyId: automation.companyId,
                    status: automation.status,
                    stage: automation.stage,
                    parentAutomationId: automation.parentAutomationId,
                    documents: automation.Documents.map((doc) => ({
                        id: doc.id,
                        name: doc.name,
                        bucketPath: doc.bucketPath,
                        createdAt: doc.createdAt,
                        updatedAt: doc.updatedAt,
                    })),
                    output_documents: automation.results.map((result) => ({
                        id: result.id,
                        status: result.status,
                        documents: result.documents.map((doc) => ({
                            id: doc.id,
                            name: doc.name,
                            status: doc.status,
                            sector: doc.sector,
                            documentId: doc.documentId,
                            document: doc.document
                                ? {
                                      id: doc.document.id,
                                      name: doc.document.name,
                                      bucketPath: doc.document.bucketPath,
                                      createdAt: doc.document.createdAt,
                                      updatedAt: doc.document.updatedAt,
                                  }
                                : null,
                            createdAt: doc.createdAt,
                            updatedAt: doc.updatedAt,
                        })),
                        createdAt: result.createdAt,
                        updatedAt: result.updatedAt,
                    })),
                    reports: automation.reports.map((report) => ({
                        id: report.id,
                        automationId: report.automationId,
                        companyId: report.companyId,
                        domain: report.domain as any, // Cast Prisma enum to domain enum
                        status: report.status as any, // Cast Prisma enum to domain enum
                        reportUrl: report.reportUrl,
                        createdAt: report.createdAt,
                        updatedAt: report.updatedAt,
                    })),
                    onePagerSummary:
                        automation.onePagers.length > 0
                            ? automation.onePagers[0].url
                            : null,
                    createdAt: automation.createdAt,
                    updatedAt: automation.updatedAt,
                }),
            )

            return {
                company,
                automations,
            }
        } catch (error) {
            if (error.message && error.message.includes("invalid character")) {
                this.logger.error(
                    `Invalid UUID format provided: ${id}`,
                    error.stack,
                )
                throw new InvalidUUIDError(id)
            }

            this.logger.error(
                `Failed to find company with automations by ID ${id}: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError(
                `Failed to find company with automations by ID`,
            )
        }
    }

    async findByName(name: string, ownerId: string): Promise<Company | null> {
        try {
            const company = await prisma.company.findFirst({
                where: { name, ownerId: requireId(ownerId, "ownerId") },
            })

            if (!company) {
                return null
            }

            return CompanyMapper.toDomain(company)
        } catch (error) {
            this.logger.error(
                `Failed to find company by name "${name}": ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError(`Failed to find company by name`)
        }
    }

    async findAll(ownerId: string): Promise<Company[]> {
        try {
            const companies = await prisma.company.findMany({
                where: { ownerId: requireId(ownerId, "ownerId") },
                orderBy: { createdAt: "desc" },
            })

            return companies.map(CompanyMapper.toDomain)
        } catch (error) {
            this.logger.error(
                `Failed to find all companies: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError(`Failed to find all companies`)
        }
    }

    async findAllWithAutomations(
        ownerId: string,
    ): Promise<CompanyWithAutomations[]> {
        try {
            const companiesWithAutomations = await prisma.company.findMany({
                where: { ownerId: requireId(ownerId, "ownerId") },
                orderBy: { createdAt: "desc" },
                include: {
                    automations: {
                        orderBy: { createdAt: "desc" },
                        include: {
                            results: {
                                orderBy: { createdAt: "desc" },
                                take: 1,
                                include: {
                                    documents: {
                                        include: {
                                            document: true,
                                        },
                                    },
                                },
                            },
                            Documents: true,
                            reports: {
                                orderBy: { createdAt: "desc" },
                            },
                            onePagers: {
                                orderBy: { createdAt: "desc" },
                                take: 1,
                                select: { url: true },
                            },
                        },
                    },
                },
            })

            return companiesWithAutomations.map((companyWithAutomations) => {
                const company = CompanyMapper.toDomain(companyWithAutomations)
                const automations = companyWithAutomations.automations.map(
                    (automation) => ({
                        id: automation.id,
                        companyId: automation.companyId,
                        status: automation.status,
                        stage: automation.stage,
                        parentAutomationId: automation.parentAutomationId,
                        documents: automation.Documents.map((doc) => ({
                            id: doc.id,
                            name: doc.name,
                            bucketPath: doc.bucketPath,
                            createdAt: doc.createdAt,
                            updatedAt: doc.updatedAt,
                        })),
                        output_documents: automation.results.map((result) => ({
                            id: result.id,
                            status: result.status,
                            documents: result.documents.map((doc) => ({
                                id: doc.id,
                                name: doc.name,
                                status: doc.status,
                                sector: doc.sector,
                                documentId: doc.documentId,
                                document: doc.document
                                    ? {
                                          id: doc.document.id,
                                          name: doc.document.name,
                                          bucketPath: doc.document.bucketPath,
                                          createdAt: doc.document.createdAt,
                                          updatedAt: doc.document.updatedAt,
                                      }
                                    : null,
                                createdAt: doc.createdAt,
                                updatedAt: doc.updatedAt,
                            })),
                            createdAt: result.createdAt,
                            updatedAt: result.updatedAt,
                        })),
                        reports: automation.reports.map((report) => ({
                            id: report.id,
                            automationId: report.automationId,
                            companyId: report.companyId,
                            domain: report.domain as any, // Cast Prisma enum to domain enum
                            status: report.status as any, // Cast Prisma enum to domain enum
                            reportUrl: report.reportUrl,
                            createdAt: report.createdAt,
                            updatedAt: report.updatedAt,
                        })),
                        onePagerSummary:
                            automation.onePagers.length > 0
                                ? automation.onePagers[0].url
                                : null,
                        createdAt: automation.createdAt,
                        updatedAt: automation.updatedAt,
                    }),
                )

                return {
                    company,
                    automations,
                }
            })
        } catch (error) {
            this.logger.error(
                `Failed to find all companies with automations: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError(
                `Failed to find all companies with automations`,
            )
        }
    }

    async update(
        id: string,
        data: UpdateCompanyData,
        ownerId: string,
    ): Promise<Company> {
        try {
            // updateMany, not update: `where` on update accepts only unique
            // fields, which would drop the ownerId filter.
            const { count } = await prisma.company.updateMany({
                where: { id: requireId(id, "id"), ownerId: requireId(ownerId, "ownerId") },
                data: {
                    ...(data.name && { name: data.name }),
                },
            })

            if (count === 0) {
                throw new RecordNotFoundError(id)
            }

            const company = await prisma.company.findFirstOrThrow({
                where: { id: requireId(id, "id"), ownerId: requireId(ownerId, "ownerId") },
            })

            return CompanyMapper.toDomain(company)
        } catch (error) {
            // A 404 from the owner-scoped write above is a real answer, not a
            // database failure — do not rewrite it into a 500.
            if (error instanceof RecordNotFoundError) throw error

            if (error.message && error.message.includes("invalid character")) {
                this.logger.error(
                    `Invalid UUID format provided: ${id}`,
                    error.stack,
                )
                throw new InvalidUUIDError(id)
            }

            this.logger.error(
                `Failed to update company ${id}: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError(`Failed to update company`)
        }
    }

    async delete(id: string, ownerId: string): Promise<void> {
        try {
            const { count } = await prisma.company.deleteMany({
                where: { id: requireId(id, "id"), ownerId: requireId(ownerId, "ownerId") },
            })

            if (count === 0) {
                throw new RecordNotFoundError(id)
            }
        } catch (error) {
            // A 404 from the owner-scoped write above is a real answer, not a
            // database failure — do not rewrite it into a 500.
            if (error instanceof RecordNotFoundError) throw error

            if (error.message && error.message.includes("invalid character")) {
                this.logger.error(
                    `Invalid UUID format provided: ${id}`,
                    error.stack,
                )
                throw new InvalidUUIDError(id)
            }

            this.logger.error(
                `Failed to delete company ${id}: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError(`Failed to delete company`)
        }
    }

    async exists(id: string, ownerId: string): Promise<boolean> {
        try {
            const count = await prisma.company.count({
                where: { id: requireId(id, "id"), ownerId: requireId(ownerId, "ownerId") },
            })

            return count > 0
        } catch (error) {
            if (error.message && error.message.includes("invalid character")) {
                this.logger.error(
                    `Invalid UUID format provided: ${id}`,
                    error.stack,
                )
                throw new InvalidUUIDError(id)
            }

            this.logger.error(
                `Failed to check if company exists ${id}: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError(`Failed to check if company exists`)
        }
    }

    async existsByName(name: string, ownerId: string): Promise<boolean> {
        try {
            const count = await prisma.company.count({
                where: { name, ownerId: requireId(ownerId, "ownerId") },
            })

            return count > 0
        } catch (error) {
            this.logger.error(
                `Failed to check if company exists by name "${name}": ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError(
                `Failed to check if company exists by name`,
            )
        }
    }
}
