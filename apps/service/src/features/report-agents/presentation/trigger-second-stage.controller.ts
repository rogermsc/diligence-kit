import { Controller, Post, Param, HttpCode, HttpStatus, Logger, UseGuards, UseFilters, Req } from '@nestjs/common'
import { Request } from 'express'
import { UserJwt } from '@/features/auth/domain/interfaces/token-manager.interface'
import { OwnershipService } from '@/shared/services/ownership.service'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { TriggerSecondStageUseCase } from '../use-cases/trigger-second-stage.usecase'
import { AutomationIdDto, AutomationIdSchema } from '../data/dtos/automation-id.schema'
import { RequestValidator } from '@/shared/validators/request-validator'
import { AuthGuard } from '@/features/auth/guards/auth.guard'
import { ApiTriggerSecondStage } from '@/shared/decorators'
import { ReportAgentsExceptionFilter } from '../infra/filters/report-agents-exception.filter'

interface TriggerSecondStageResponse {
    automationId: string
    status: string
}

@ApiTags('Report Agents')
@ApiBearerAuth('access-token')
@Controller('automation')
@UseGuards(AuthGuard)
@UseFilters(ReportAgentsExceptionFilter)
export class TriggerSecondStageController {
    private readonly logger = new Logger(TriggerSecondStageController.name)

    constructor(
        private readonly triggerSecondStageUseCase: TriggerSecondStageUseCase,
        private readonly ownershipService: OwnershipService,
    ) { }

    @Post(':automationId/second-stage')
    @HttpCode(HttpStatus.ACCEPTED)
    @ApiTriggerSecondStage()
    async triggerSecondStage(
        @Param() params: unknown,
        @Req() req: Request & { user: UserJwt },
    ): Promise<TriggerSecondStageResponse> {
        // Validate UUID format
        const { automationId } = RequestValidator.validate<AutomationIdDto>(
            params,
            AutomationIdSchema,
        )

        // Starting stage 2 writes four new automations and dispatches the
        // dataroom to the agent, so it must be owner-checked like every other
        // automation endpoint.
        await this.ownershipService.assertAutomationOwned(automationId, req.user.id)

        this.logger.log(`Triggering second stage for automation: ${automationId}`)

        // Execute use case
        await this.triggerSecondStageUseCase.execute({ automationId })

        this.logger.log(`Successfully triggered second stage for automation: ${automationId}`)

        return {
            automationId,
            status: 'queued'
        }
    }
}