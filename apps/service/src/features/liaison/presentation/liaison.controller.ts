import {
    Controller,
    Post,
    Get,
    Body,
    UseGuards,
    Req,
    Param,
    Inject,
} from "@nestjs/common"
import { AuthGuard } from "@/features/auth/guards/auth.guard"
import { LiaisonGateway } from "../domain/interfaces/liaison-gateway.interface"
import {
    ChatRequestDto,
    chatRequestSchema,
} from "../data/dtos/chat-request.schema"
import { Tenancy, NoTenancy } from "@/shared/tenancy/tenancy.decorator"
import { RequestValidator } from "@/shared/validators/request-validator"
import { z } from "zod"

const sessionIdSchema = z.object({
    sessionId: z.string().uuid("Invalid session ID format"),
})

@Controller("liaison")
@UseGuards(AuthGuard)
export class LiaisonController {
    constructor(
        @Inject("LiaisonGateway")
        private readonly liaisonGateway: LiaisonGateway,
    ) {}

    @Post("chat")
    // automation_id and company_context steer which Cloud Logging entries and
    // which company record the agent reads, and both arrive from the client. The
    // company id is resolved the way ContextExtractor.py resolves it — Python
    // `or` is falsy-aware, so `{id: "", company_id: "<victim>"}` reaches
    // company_id there and must reach it here too.
    @Tenancy({
        automation: { from: "body:automation_id", optional: true },
        company: {
            from: [
                "body:company_context.id",
                "body:company_context.company_id",
            ],
            optional: true,
        },
    })
    async sendMessage(@Body() body: unknown, @Req() request: any) {
        const validatedData = RequestValidator.validate(body, chatRequestSchema)
        const userId = request.user.id

        const automationId = validatedData.automation_id
        const companyContext = validatedData.company_context

        return this.liaisonGateway.sendMessage({
            message: validatedData.message,
            session_id: validatedData.session_id,
            user_id: userId,
            automation_id: automationId,
            company_context: companyContext,
        })
    }

    @Get("session/last")
    @NoTenancy("the agent scopes the session to the caller's user id")
    async getOrCreateSession(@Req() request: any) {
        const userId = request.user.id
        return this.liaisonGateway.getOrCreateSession(userId)
    }

    @Post("session/create")
    @NoTenancy("creates a session owned by the caller")
    async createNewSession(@Req() request: any) {
        const userId = request.user.id
        return this.liaisonGateway.createNewSession(userId)
    }

    @Get("messages/:sessionId")
    @NoTenancy("the agent filters history by the caller's user id")
    async getMessageHistory(@Param() params: unknown, @Req() request: any) {
        const { sessionId } = RequestValidator.validate(params, sessionIdSchema)
        const userId = request.user.id
        return this.liaisonGateway.getMessageHistory(sessionId, userId)
    }
}
