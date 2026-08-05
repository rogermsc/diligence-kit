import axios from 'axios';
import { LiaisonGateway, ChatMessageRequest, ChatMessageResponse, SessionResponse, MessageHistoryResponse } from '../../domain/interfaces/liaison-gateway.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class LiaisonGatewayAxiosAdapter implements LiaisonGateway {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = process.env.LIAISON_AGENT_URL!;
    this.apiKey = process.env.LIAISON_API_KEY!;
  }

  private readonly TIMEOUT_MS = 30_000;

  async sendMessage(request: ChatMessageRequest): Promise<ChatMessageResponse> {
    const response = await axios.post(
      `${this.baseUrl}/chat`,
      request,
      {
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        timeout: this.TIMEOUT_MS,
      }
    );
    return response.data;
  }

  async getOrCreateSession(userId: string): Promise<SessionResponse> {
    const response = await axios.get(
      `${this.baseUrl}/session/last`,
      {
        params: { user_id: userId },
        headers: { 'X-API-Key': this.apiKey },
        timeout: this.TIMEOUT_MS,
      }
    );
    return response.data;
  }

  async createNewSession(userId: string): Promise<SessionResponse> {
    const response = await axios.post(
      `${this.baseUrl}/session/create`,
      { user_id: userId },
      {
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        timeout: this.TIMEOUT_MS,
      }
    );
    return response.data;
  }

  async getMessageHistory(sessionId: string, userId: string): Promise<MessageHistoryResponse> {
    const response = await axios.get(
      `${this.baseUrl}/chat/messages/${sessionId}`,
      {
        params: { user_id: userId },
        headers: { 'X-API-Key': this.apiKey },
        timeout: this.TIMEOUT_MS,
      }
    );
    return response.data;
  }
}
