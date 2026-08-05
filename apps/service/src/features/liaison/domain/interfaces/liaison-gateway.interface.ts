export interface ChatMessageRequest {
  message: string;
  session_id?: string;
  user_id: string;
  automation_id?: string;
  company_context?: Record<string, any>;
}

export interface ChatMessageResponse {
  response: string;
  session_id: string;
}

export interface SessionResponse {
  session_id: string;
}

export interface ChatMessage {
  user_message: string;
  agent_response: string;
  created_at: Date;
}

export interface MessageHistoryResponse {
  session_id: string;
  messages: ChatMessage[];
}

export interface LiaisonGateway {
  sendMessage(request: ChatMessageRequest): Promise<ChatMessageResponse>;
  getOrCreateSession(userId: string): Promise<SessionResponse>;
  createNewSession(userId: string): Promise<SessionResponse>;
  getMessageHistory(sessionId: string, userId: string): Promise<MessageHistoryResponse>;
}
