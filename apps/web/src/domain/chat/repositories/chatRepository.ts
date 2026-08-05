import { ChatRequest, ChatResponse, SessionResponse, MessageHistoryResponse } from '../models/chat';

export interface ChatRepository {
  sendMessage(request: ChatRequest): Promise<ChatResponse>;
  getOrCreateSession(): Promise<SessionResponse>;
  createNewSession(): Promise<SessionResponse>;
  getMessageHistory(sessionId: string): Promise<MessageHistoryResponse>;
}
