"use client";

import { useChatViewModel } from "@/presentation/chat/chatViewModel";
import { useCompanyContext } from "./chat-company-context";
import { ChatFab } from "./chat-fab";
import { ChatBox } from "./chat-box";

export function ChatWidget() {
  const { company } = useCompanyContext();
  const {
    isOpen,
    messages,
    loading,
    sending,
    error,
    openChat,
    closeChat,
    startNewChat,
    sendMessage,
  } = useChatViewModel(company);

  return (
    <>
      <ChatFab onClick={openChat} />
      <ChatBox
        isOpen={isOpen}
        messages={messages}
        loading={loading}
        sending={sending}
        error={error}
        onClose={closeChat}
        onSendMessage={sendMessage}
        onNewChat={startNewChat}
      />
    </>
  );
}
