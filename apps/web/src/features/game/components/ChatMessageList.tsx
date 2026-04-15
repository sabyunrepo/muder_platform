import { useEffect, useRef } from "react";
import { ChatMessage } from "./ChatMessage";
import type { ChatEntry } from "@/stores/gameChatStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessageListProps {
  messages: ChatEntry[];
  emptyText?: string;
}

// ---------------------------------------------------------------------------
// ChatMessageList
// ---------------------------------------------------------------------------

/**
 * Scrollable message list that auto-scrolls to bottom on new messages.
 */
export function ChatMessageList({
  messages,
  emptyText = "아직 메시지가 없습니다.",
}: ChatMessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">{emptyText}</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {messages.map((msg, i) => (
        <ChatMessage
          key={`${msg.senderId}-${msg.ts}-${i}`}
          nickname={msg.nickname}
          text={msg.text}
          ts={msg.ts}
          isWhisper={msg.isWhisper}
          isMine={msg.isMine}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}
