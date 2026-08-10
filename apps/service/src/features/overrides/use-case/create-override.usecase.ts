import { Inject, Injectable } from "@nestjs/common"
import { Prisma } from "@prisma/client"

import { Usecase } from "@/shared/interfaces/usecase"
import {
    AnalysisOverrideRecord,
    OverrideRepository,
    OverrideTargetType,
} from "../domain/repository/override-repository.interface"

export interface CreateOverrideInput {
    automationId: string
    targetType: OverrideTargetType
    targetKey: string
    value?: unknown
    rationale: string
    authorId: string
}

@Injectable()
export class CreateOverrideUseCase implements Usecase<
    CreateOverrideInput,
    AnalysisOverrideRecord
> {
    constructor(
        @Inject("OverrideRepository")
        private readonly overrides: OverrideRepository,
    ) {}

    async execute(input: CreateOverrideInput): Promise<AnalysisOverrideRecord> {
        return this.overrides.create({
            automationId: input.automationId,
            targetType: input.targetType,
            targetKey: input.targetKey,
            value: input.value as Prisma.InputJsonValue | undefined,
            rationale: input.rationale,
            authorId: input.authorId,
        })
    }
}
