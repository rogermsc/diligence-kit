import { Controller, Post, Get, Body, UseGuards, Req, Param, Inject } from '@nestjs/common';
import { AuthGuard } from '@/features/auth/guards/auth.guard';
import { LiaisonGateway } from '../domain/interfaces/liaison-gateway.interface';
import { ChatRequestDto, chatRequestSchema } from '../data/dtos/chat-request.schema';
import { RequestValidator } from '@/shared/validators/request-validator';
import { z } from 'zod';

const sessionIdSchema = z.object({ sessionId: z.string().uuid('Invalid session ID format') });

@Controller('liaison')
@UseGuards(AuthGuard)
export class LiaisonController {
  constructor(
    @Inject('LiaisonGateway')
    private readonly liaisonGateway: LiaisonGateway,
  ) {}

  @Post('chat')
  async sendMessage(@Body() body: unknown, @Req() request: any) {
    const validatedData = RequestValidator.validate(body, chatRequestSchema);
    const userId = request.user.id;

    return this.liaisonGateway.sendMessage({
      message: validatedData.message,
      session_id: validatedData.session_id,
      user_id: userId,
      automation_id: validatedData.automation_id,
      company_context: validatedData.company_context,
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
