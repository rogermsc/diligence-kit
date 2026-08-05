export interface ChatMessage {
  user_message: string;
  agent_response: string;
  created_at: Date;
}

export interface ChatRequest {
  message: string;
  session_id?: string;
  automation_id?: string;
  company_context?: Record<string, any>;
}

export interface ChatResponse {
  response: string;
  session_id: string;
}

export interface SessionResponse {
  session_id: string;
}

export interface MessageHistoryResponse {
  session_id: string;
  messages: ChatMessage[];
}
