import { useEffect, useRef } from "react";
import { ChatMessage } from "../ChatMessage";
import type { ChatMessageProps } from "../ChatMessage";
import type { TabType } from "./types";

interface MessageListProps {
  messages: ChatMessageProps[];
  activeTab: TabType;
  selectedGroupId: string;
}

export function MessageList({ messages, activeTab, selectedGroupId }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {messages.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          {activeTab === "group" && !selectedGroupId
            ? "그룹을 선택하거나 만들어보세요."
            : "아직 메시지가 없습니다."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {messages.map((msg, i) => (
            <ChatMessage
              key={`${msg.nickname}-${msg.ts}-${i}`}
              {...msg}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
}
