import { ChatRepository } from '@/domain/chat/repositories/chatRepository';
import { ChatRequest, ChatResponse, SessionResponse, MessageHistoryResponse } from '@/domain/chat/models/chat';

export class ChatRepositoryImpl implements ChatRepository {
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    return response.json();
  }

  async getOrCreateSession(): Promise<SessionResponse> {
    const response = await fetch('/api/chat/session');

    if (!response.ok) {
      throw new Error('Failed to get session');
    }

    return response.json();
  }

  async createNewSession(): Promise<SessionResponse> {
    const response = await fetch('/api/chat/session', {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to create session');
    }

    return response.json();
  }

  async getMessageHistory(sessionId: string): Promise<MessageHistoryResponse> {
    const response = await fetch(`/api/chat/messages?session_id=${sessionId}`);

    if (!response.ok) {
      throw new Error('Failed to get message history');
    }

    return response.json();
  }
}
