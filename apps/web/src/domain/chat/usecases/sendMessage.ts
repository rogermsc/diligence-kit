import { ChatRepository } from '../repositories/chatRepository';
import { ChatRequest, ChatResponse } from '../models/chat';

export class SendMessageUseCase {
  constructor(private repository: ChatRepository) {}

  async execute(request: ChatRequest): Promise<ChatResponse> {
    return this.repository.sendMessage(request);
  }
}
