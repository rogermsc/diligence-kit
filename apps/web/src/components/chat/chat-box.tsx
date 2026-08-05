"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, PlusCircle, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ChatMessage } from "@/domain/chat/models/chat";
import { ChatMessageBubble } from "./chat-message-bubble";

interface ChatBoxProps {
  isOpen: boolean;
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  onClose: () => void;
  onSendMessage: (message: string) => void;
  onNewChat: () => void;
}

export function ChatBox({
  isOpen,
  messages,
  loading,
  sending,
  error,
  onClose,
  onSendMessage,
  onNewChat,
}: ChatBoxProps) {
  const [inputValue, setInputValue] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, sending]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !sending) {
      onSendMessage(inputValue);
      setInputValue("");
    }
  };

  const toggleSize = () => {
    setIsExpanded(!isExpanded);
  };

  const boxSizeClass = isExpanded 
    ? "w-[600px] h-[700px]" 
    : "w-96 h-[600px]";

  return (
    <Card className={`fixed bottom-6 right-6 ${boxSizeClass} flex flex-col shadow-2xl z-50 transition-all duration-300`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h3 className="font-semibold text-lg">Support</h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSize}
            title={isExpanded ? "Minimize" : "Expand"}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNewChat}
            disabled={loading}
            title="New Chat"
          >
            <PlusCircle className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} title="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && messages.length === 0 && (
          <div className="text-center text-muted-foreground">
            Loading...
          </div>
        )}

        {error && (
          <div className="text-center text-destructive text-sm">
            {error}
          </div>
        )}

        {messages.map((msg, idx) => (
          <ChatMessageBubble key={idx} message={msg} />
        ))}

        {sending && (
          <div className="text-center text-muted-foreground text-sm">
            Thinking...
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your message..."
            disabled={sending}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={sending || !inputValue.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </Card>
  );
}
