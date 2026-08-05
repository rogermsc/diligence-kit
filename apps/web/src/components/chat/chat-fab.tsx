"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatFabProps {
  onClick: () => void;
}

export function ChatFab({ onClick }: ChatFabProps) {
  return (
    <Button
      onClick={onClick}
      className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all z-40"
      size="icon"
    >
      <MessageCircle className="h-6 w-6" />
    </Button>
  );
}
