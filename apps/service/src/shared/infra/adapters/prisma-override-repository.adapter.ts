import { Injectable } from "@nestjs/common"
import { Prisma } from "@prisma/client"

import { prisma } from "@/shared/infra/prisma"
import {
    AnalysisOverrideRecord,
    CreateOverrideData,
    OverrideRepository,
    OverrideTargetType,
} from "@/features/overrides/domain/repository/override-repository.interface"

@Injectable()
export class PrismaOverrideRepositoryAdapter implements OverrideRepository {
    async create(data: CreateOverrideData): Promise<AnalysisOverrideRecord> {
        const row = await prisma.analysisOverride.create({
            data: {
                automationId: data.automationId,
                targetType: data.targetType,
                targetKey: data.targetKey,
                // Prisma skips `undefined`, which is what an annotation and a
                // revert both want: the column stays null rather than being set
                // to a JSON null.
                value: data.value,
                rationale: data.rationale,
                authorId: data.authorId,
            },
        })
        return toRecord(row)
    }

    async listByAutomation(
        automationId: string,
    ): Promise<AnalysisOverrideRecord[]> {
        const rows = await prisma.analysisOverride.findMany({
            where: { automationId },
            orderBy: { createdAt: "asc" },
        })
        return rows.map(toRecord)
    }
}

function toRecord(row: {
    id: string
    automationId: string
    targetType: string
    targetKey: string
    value: Prisma.JsonValue | null
    rationale: string
    authorId: string
    createdAt: Date
}): AnalysisOverrideRecord {
    return {
        id: row.id,
        automationId: row.automationId,
        targetType: row.targetType as OverrideTargetType,
        targetKey: row.targetKey,
        value: row.value,
        rationale: row.rationale,
        authorId: row.authorId,
        createdAt: row.createdAt,
    }
}
