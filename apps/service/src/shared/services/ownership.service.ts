import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common"
import { prisma } from "@/shared/infra/prisma"

/**
 * Prisma treats an `undefined` value in a `where` clause as "no filter", so
 * `{ id: undefined, ownerId }` silently becomes `WHERE ownerId = ?` and matches
 * the caller's own first record — the assertion passes having verified nothing.
 * Every id must therefore be proven present before it reaches a query.
 */
function requireId(value: string, field: string): string {
    if (typeof value !== "string" || value.length === 0) {
        throw new BadRequestException(`${field} is required`)
    }
    return value
}

/**
 * Authorization checks for records reached by id.
 *
 * Company ownership is enforced in the company repository, where `ownerId` is a
 * required argument. Automations and documents are addressed by their own ids
 * though, so they need an explicit check: each resolves to its owning company in
 * a single query and is treated as absent when it belongs to someone else.
 *
 * These throw NotFound rather than Forbidden on purpose — a 403 would confirm
 * that the id exists, which is exactly what an id-guessing attacker wants.
 */
@Injectable()
export class OwnershipService {
    async assertAutomationOwned(
        automationId: string,
        userId: string,
    ): Promise<void> {
        const automation = await prisma.automation.findFirst({
            where: {
                id: requireId(automationId, "automationId"),
                company: { ownerId: requireId(userId, "userId") },
            },
            select: { id: true },
        })

        if (!automation) {
            throw new NotFoundException(`Automation ${automationId} not found`)
        }
    }

    async assertCompanyOwned(companyId: string, userId: string): Promise<void> {
        const company = await prisma.company.findFirst({
            where: {
                id: requireId(companyId, "companyId"),
                ownerId: requireId(userId, "userId"),
            },
            select: { id: true },
        })

        if (!company) {
            throw new NotFoundException(`Company ${companyId} not found`)
        }
    }

    async assertDocumentOwned(
        documentId: string,
        userId: string,
    ): Promise<void> {
        const document = await prisma.documents.findFirst({
            where: {
                id: requireId(documentId, "documentId"),
                automation: { company: { ownerId: requireId(userId, "userId") } },
            },
            select: { id: true },
        })

        if (!document) {
            throw new NotFoundException(`Document ${documentId} not found`)
        }
    }
}
