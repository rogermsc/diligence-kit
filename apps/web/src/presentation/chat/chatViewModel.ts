"use client";

import { useState, useCallback, useMemo } from 'react';
import { ChatRepositoryImpl } from '@/data/chat/chatRepositoryImpl';
import { ChatMessage } from '@/domain/chat/models/chat';
// One definition, in the provider that owns it. This file kept a second copy,
// which is how the two drifted the moment the context gained a field.
import type { CompanyInfo } from '@/components/chat/chat-company-context';

export function useChatViewModel(companyContext?: CompanyInfo | null) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Four use-case classes used to be constructed here on every render, each one
  // a 10-line wrapper around a single repository call with no logic in it.
  const repository = useMemo(() => new ChatRepositoryImpl(), []);

  const loadSession = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const sessionResponse = await repository.getOrCreateSession();
      setSessionId(sessionResponse.session_id);

      const historyResponse = await repository.getMessageHistory(sessionResponse.session_id);
      setMessages(historyResponse.messages);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load session';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [repository]);

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
      
      const sessionResponse = await repository.createNewSession();
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

      const response = await repository.sendMessage({
        message,
        session_id: sessionId || undefined,
        // The analysis as well as the name. The assistant could previously
        // only be asked about the platform; with the adjudicated decisions in
        // context it can answer "why £3.2M?" from the rule that chose it.
        company_context: companyContext
          ? {
              id: companyContext.id,
              name: companyContext.name,
              ...(companyContext.analysisContext ?? {}),
            }
          : undefined,
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
