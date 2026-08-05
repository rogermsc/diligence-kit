"use client";

import { useState, useCallback } from 'react';
import { ChatRepositoryImpl } from '@/data/chat/chatRepositoryImpl';
import { SendMessageUseCase } from '@/domain/chat/usecases/sendMessage';
import { GetOrCreateSessionUseCase } from '@/domain/chat/usecases/getOrCreateSession';
import { CreateNewSessionUseCase } from '@/domain/chat/usecases/createNewSession';
import { GetMessageHistoryUseCase } from '@/domain/chat/usecases/getMessageHistory';
import { ChatMessage } from '@/domain/chat/models/chat';

interface CompanyInfo {
  id: string;
  name: string;
}

export function useChatViewModel(companyContext?: CompanyInfo | null) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const repository = new ChatRepositoryImpl();
  const sendMessageUseCase = new SendMessageUseCase(repository);
  const getOrCreateSessionUseCase = new GetOrCreateSessionUseCase(repository);
  const createNewSessionUseCase = new CreateNewSessionUseCase(repository);
  const getMessageHistoryUseCase = new GetMessageHistoryUseCase(repository);

  const loadSession = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const sessionResponse = await getOrCreateSessionUseCase.execute();
      setSessionId(sessionResponse.session_id);

      const historyResponse = await getMessageHistoryUseCase.execute(sessionResponse.session_id);
      setMessages(historyResponse.messages);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load session';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const openChat = useCallback(async () => {
    setIsOpen(true);
    if (!sessionId) {
      await loadSession();
    }
  }, [sessionId, loadSession]);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const startNewChat = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const sessionResponse = await createNewSessionUseCase.execute();
      setSessionId(sessionResponse.session_id);
      setMessages([]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create new session';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;

    try {
      setSending(true);
      setError(null);

      const tempUserMessage: ChatMessage = {
        user_message: message,
        agent_response: '',
        created_at: new Date(),
      };
      setMessages(prev => [...prev, tempUserMessage]);

      const response = await sendMessageUseCase.execute({
        message,
        session_id: sessionId || undefined,
        company_context: companyContext ? { id: companyContext.id, name: companyContext.name } : undefined,
      });

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          user_message: message,
          agent_response: response.response,
          created_at: new Date(),
        };
        return updated;
      });

      setSessionId(response.session_id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  }, [sessionId, companyContext]);

  return {
    isOpen,
    messages,
    loading,
    sending,
    error,
    openChat,
    closeChat,
    startNewChat,
    sendMessage,
  };
}
