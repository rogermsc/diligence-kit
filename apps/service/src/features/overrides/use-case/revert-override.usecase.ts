import { Inject, Injectable } from "@nestjs/common"

import { Usecase } from "@/shared/interfaces/usecase"
import {
    AnalysisOverrideRecord,
    OverrideRepository,
    OverrideTargetType,
} from "../domain/repository/override-repository.interface"

export interface RevertOverrideInput {
    automationId: string
    targetType: OverrideTargetType
    targetKey: string
    rationale: string
    authorId: string
}

/**
 * Withdraws an earlier override by appending a row with no value, so the
 * resolver falls back to whatever the machine said.
 *
 * Deliberately not a DELETE. Removing the row would remove the evidence that
 * anyone ever disagreed, which is the one thing this table exists to keep — and
 * changing your mind is itself a decision worth attributing, which is why the
 * rationale is required here too.
 */
@Injectable()
export class RevertOverrideUseCase implements Usecase<
    RevertOverrideInput,
    AnalysisOverrideRecord
> {
    constructor(
        @Inject("OverrideRepository")
        private readonly overrides: OverrideRepository,
    ) {}

    async execute(input: RevertOverrideInput): Promise<AnalysisOverrideRecord> {
        return this.overrides.create({
            automationId: input.automationId,
            targetType: input.targetType,
            targetKey: input.targetKey,
            // No value: this is the withdrawal.
            rationale: input.rationale,
            authorId: input.authorId,
        })
    }
}
