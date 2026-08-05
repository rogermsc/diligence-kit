import { ChatRepository } from '../repositories/chatRepository';
import { MessageHistoryResponse } from '../models/chat';

export class GetMessageHistoryUseCase {
  constructor(private repository: ChatRepository) {}

  async execute(sessionId: string): Promise<MessageHistoryResponse> {
    return this.repository.getMessageHistory(sessionId);
  }
}
