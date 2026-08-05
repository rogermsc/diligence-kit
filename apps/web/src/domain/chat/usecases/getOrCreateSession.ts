import { ChatRepository } from '../repositories/chatRepository';
import { SessionResponse } from '../models/chat';

export class GetOrCreateSessionUseCase {
  constructor(private repository: ChatRepository) {}

  async execute(): Promise<SessionResponse> {
    return this.repository.getOrCreateSession();
  }
}
