import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Req,
    UseGuards,
} from "@nestjs/common"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"

import { AuthGuard } from "@/features/auth/guards/auth.guard"
import { RequestValidator } from "@/shared/validators/request-validator"
import { Tenancy } from "@/shared/tenancy/tenancy.decorator"
import { UserJwt } from "@/features/auth/domain/interfaces/token-manager.interface"

import {
    AutomationIdParamSchema,
    CreateOverrideDto,
    CreateOverrideSchema,
    RevertOverrideDto,
    RevertOverrideSchema,
    RevertParamsSchema,
} from "../data/dtos/override.schema"
import { CreateOverrideUseCase } from "../use-case/create-override.usecase"
import { ListOverridesUseCase } from "../use-case/list-overrides.usecase"
import { RevertOverrideUseCase } from "../use-case/revert-override.usecase"

interface AuthenticatedRequest extends Request {
    user: UserJwt
}

/**
 * Human judgement about a run.
 *
 * Every route is scoped to an automation the caller owns, and the analysis
 * itself is never touched — these only ever append to analysis_overrides.
 */
@ApiTags("Overrides")
@ApiBearerAuth("access-token")
@Controller("automation/:automationId")
@UseGuards(AuthGuard)
export class OverridesController {
    constructor(
        private readonly createOverrideUseCase: CreateOverrideUseCase,
        private readonly listOverridesUseCase: ListOverridesUseCase,
        private readonly revertOverrideUseCase: RevertOverrideUseCase,
    ) {}

    @Post("override")
    @Tenancy({ automation: "param:automationId" })
    async create(
        @Param() params: unknown,
        @Body() body: unknown,
        @Req() req: AuthenticatedRequest,
    ) {
        const { automationId } = RequestValidator.validate(
            params,
            AutomationIdParamSchema,
        )
        const input = RequestValidator.validate<CreateOverrideDto>(
            body,
            CreateOverrideSchema,
        )

        return this.createOverrideUseCase.execute({
            automationId,
            targetType: input.targetType,
            targetKey: input.targetKey,
            value: input.value,
            rationale: input.rationale,
            authorId: req.user.id,
        })
    }

    @Get("overrides")
    @Tenancy({ automation: "param:automationId" })
    async list(@Param() params: unknown) {
        const { automationId } = RequestValidator.validate(
            params,
            AutomationIdParamSchema,
        )
        return this.listOverridesUseCase.execute({ automationId })
    }

    /**
     * POST, not DELETE: this appends a withdrawal rather than removing a row.
     * The trail has to survive someone changing their mind.
     */
    @Post("override/:targetType/:targetKey/revert")
    @Tenancy({ automation: "param:automationId" })
    async revert(
        @Param() params: unknown,
        @Body() body: unknown,
        @Req() req: AuthenticatedRequest,
    ) {
        const { automationId, targetType, targetKey } =
            RequestValidator.validate(params, RevertParamsSchema)
        const input = RequestValidator.validate<RevertOverrideDto>(
            body,
            RevertOverrideSchema,
        )

        return this.revertOverrideUseCase.execute({
            automationId,
            targetType,
            targetKey,
            rationale: input.rationale,
            authorId: req.user.id,
        })
    }
}
