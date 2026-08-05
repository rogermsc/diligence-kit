"use client";

import { ChatMessage } from "@/domain/chat/models/chat";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { Config } from "dompurify";
import { useEffect, useState } from "react";

const DOMPURIFY_CONFIG: Config = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'code', 'pre', 'blockquote', 'hr',
    'table', 'thead', 'tbody', 'tr', 'th', 'td'],
  ALLOWED_ATTR: ['href', 'title', 'class', 'target', 'rel'],
  ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel):/i,
};

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const [sanitizedHtml, setSanitizedHtml] = useState("");

  useEffect(() => {
    if (message.agent_response) {
      const parseMarkdown = async () => {
        const html = await marked.parse(message.agent_response);
        const clean = DOMPurify.sanitize(html, DOMPURIFY_CONFIG);
        setSanitizedHtml(clean);
      };
      parseMarkdown();
    }
  }, [message.agent_response]);

  return (
    <div className="space-y-2">
      {/* User message */}
      <div className="flex justify-end">
        <div className="bg-primary text-primary-foreground rounded-lg px-4 py-2 max-w-[80%] whitespace-pre-wrap">
          {message.user_message}
        </div>
      </div>

      {/* Agent response with markdown */}
      {message.agent_response && (
        <div className="flex justify-start">
          <div 
            className="bg-muted rounded-lg px-4 py-2 max-w-[80%] prose text-sm"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          />
        </div>
      )}
    </div>
  );
}
