import { Controller, Post, Get, Body, UseGuards, Req, Param, Inject } from '@nestjs/common';
import { AuthGuard } from '@/features/auth/guards/auth.guard';
import { LiaisonGateway } from '../domain/interfaces/liaison-gateway.interface';
import { ChatRequestDto, chatRequestSchema } from '../data/dtos/chat-request.schema';
import { OwnershipService } from '@/shared/services/ownership.service';
import { RequestValidator } from '@/shared/validators/request-validator';
import { z } from 'zod';

const sessionIdSchema = z.object({ sessionId: z.string().uuid('Invalid session ID format') });

@Controller('liaison')
@UseGuards(AuthGuard)
export class LiaisonController {
  constructor(
    @Inject('LiaisonGateway')
    private readonly liaisonGateway: LiaisonGateway,
    private readonly ownershipService: OwnershipService,
  ) {}

  @Post('chat')
  async sendMessage(@Body() body: unknown, @Req() request: any) {
    const validatedData = RequestValidator.validate(body, chatRequestSchema);
    const userId = request.user.id;

    // automation_id and company_context steer which Cloud Logging entries and
    // which company record the agent reads. They arrive from the client, so
    // anything the caller does not own is dropped rather than forwarded — the
    // liaison agent has no way to check ownership itself.
    const automationId = validatedData.automation_id;
    if (automationId) {
      await this.ownershipService.assertAutomationOwned(automationId, userId);
    }

    const companyContext = validatedData.company_context as
      | Record<string, string>
      | undefined;
    // Must match how the agent resolves this field. ContextExtractor.py uses
    // Python `or`, which is falsy-aware, so `{id: "", company_id: "<victim>"}`
    // resolves to company_id there. `??` only falls through on null/undefined,
    // so it would have yielded "" here and skipped the check entirely.
    const contextCompanyId = companyContext?.id || companyContext?.company_id;
    if (contextCompanyId) {
      await this.ownershipService.assertCompanyOwned(contextCompanyId, userId);
    }

    return this.liaisonGateway.sendMessage({
      message: validatedData.message,
      session_id: validatedData.session_id,
      user_id: userId,
      automation_id: automationId,
      company_context: companyContext,
    });
  }

  @Get('session/last')
  async getOrCreateSession(@Req() request: any) {
    const userId = request.user.id;
    return this.liaisonGateway.getOrCreateSession(userId);
  }

  @Post('session/create')
  async createNewSession(@Req() request: any) {
    const userId = request.user.id;
    return this.liaisonGateway.createNewSession(userId);
  }

  @Get('messages/:sessionId')
  async getMessageHistory(@Param() params: unknown, @Req() request: any) {
    const { sessionId } = RequestValidator.validate(params, sessionIdSchema);
    const userId = request.user.id;
    return this.liaisonGateway.getMessageHistory(sessionId, userId);
  }
}
