import { Injectable, Logger } from "@nestjs/common"
import { Document } from "@/shared/domain/entities/document.entity"
import {
    DocumentRepository,
    CreateDocumentData,
    UpdateOpenaiFileIdData,
} from "@/shared/repository/document-repository.interface"
import {
    DatabaseAccessError,
    InvalidUUIDError,
} from "@/shared/errors/db/data-base-error"
import { prisma } from "@/shared/infra/prisma"
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library"

@Injectable()
export class PrismaDocumentRepositoryAdapter implements DocumentRepository {
    private readonly logger = new Logger(PrismaDocumentRepositoryAdapter.name)

    async create(data: CreateDocumentData): Promise<Document> {
        try {
            const document = await prisma.documents.upsert({
                where: {
                    automationId_name: {
                        automationId: data.automationId,
                        name: data.name,
                    },
                },
                update: {
                    bucketPath: data.bucketPath,
                    updatedAt: new Date(),
                },
                create: {
                    automationId: data.automationId,
                    name: data.name,
                    bucketPath: data.bucketPath,
                },
            })

            return new Document(
                document.id,
                document.automationId,
                document.name,
                document.bucketPath,
                document.createdAt,
                document.updatedAt,
                document.openaiFileId ?? undefined,
            )
        } catch (error) {
            this.handleDatabaseError(error, "create/update document")
        }
    }

    async createMany(
        data: CreateDocumentData[],
        tx?: any,
    ): Promise<Document[]> {
        try {
            const client = tx || prisma
            const documents = await client.$transaction(
                data.map((item: CreateDocumentData) =>
                    client.documents.upsert({
                        where: {
                            automationId_name: {
                                automationId: item.automationId,
                                name: item.name,
                            },
                        },
                        update: {
                            bucketPath: item.bucketPath,
                            updatedAt: new Date(),
                        },
                        create: {
                            automationId: item.automationId,
                            name: item.name,
                            bucketPath: item.bucketPath,
                        },
                    }),
                ),
            )

            return documents.map(
                (doc) =>
                    new Document(
                        doc.id,
                        doc.automationId,
                        doc.name,
                        doc.bucketPath,
                        doc.createdAt,
                        doc.updatedAt,
                        doc.openaiFileId ?? undefined,
                    ),
            )
        } catch (error) {
            this.handleDatabaseError(error, "create/update documents")
        }
    }

    private handleDatabaseError(error: any, operation: string): never {
        if (error instanceof PrismaClientKnownRequestError) {
            // Outros erros conhecidos do Prisma
            this.logger.error(
                `Prisma error during ${operation}: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError(
                `Database error during ${operation}: ${error.message}`,
            )
        }

        // Erros gerais
        this.logger.error(
            `Failed to ${operation}: ${error.message}`,
            error.stack,
        )
        throw new DatabaseAccessError(`Failed to ${operation}`)
    }

    async findById(id: string): Promise<Document | null> {
        try {
            const document = await prisma.documents.findUnique({
                where: { id },
            })

            if (!document) {
                return null
            }

            return new Document(
                document.id,
                document.automationId,
                document.name,
                document.bucketPath,
                document.createdAt,
                document.updatedAt,
                document.openaiFileId ?? undefined,
            )
        } catch (error) {
            if (error.message && error.message.includes("invalid character")) {
                this.logger.error(
                    `Invalid UUID format provided: ${id}`,
                    error.stack,
                )
                throw new InvalidUUIDError(id)
            }

            this.logger.error(
                `Failed to find document by ID ${id}: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError("Failed to find document by ID")
        }
    }

    async findByAutomationId(automationId: string): Promise<Document[]> {
        try {
            const documents = await prisma.documents.findMany({
                where: { automationId },
                orderBy: { createdAt: "desc" },
            })

            return documents.map(
                (doc) =>
                    new Document(
                        doc.id,
                        doc.automationId,
                        doc.name,
                        doc.bucketPath,
                        doc.createdAt,
                        doc.updatedAt,
                        doc.openaiFileId ?? undefined,
                    ),
            )
        } catch (error) {
            if (error.message && error.message.includes("invalid character")) {
                this.logger.error(
                    `Invalid UUID format provided: ${automationId}`,
                    error.stack,
                )
                throw new InvalidUUIDError(automationId)
            }

            this.logger.error(
                `Failed to find documents by automation ID ${automationId}: ${error.message}`,
                error.stack,
            )
            throw new DatabaseAccessError(
                "Failed to find documents by automation ID",
            )
        }
    }

    async updateOpenaiFileIds(
        updates: UpdateOpenaiFileIdData[],
    ): Promise<void> {
        if (updates.length === 0) return

        try {
            await prisma.$transaction(
                updates.map((u) =>
                    prisma.documents.update({
                        where: { id: u.id },
                        data: { openaiFileId: u.openaiFileId },
                    }),
                ),
            )
        } catch (error) {
            this.handleDatabaseError(error, "update openaiFileIds")
        }
    }
}
