import { useState, useRef, useEffect, useCallback } from "react";
import { Send, MessageCircle } from "lucide-react";
import { Button, Spinner, EmptyState } from "@/shared/components/ui";
import {
  useChatMessages,
  useSendMessage,
  useMarkAsRead,
} from "@/features/social/api";
import type { ChatMessageResponse } from "@/features/social/api";
import { useAuthStore } from "@/stores/authStore";
import { MAX_MESSAGE_LENGTH } from "@/features/social/constants";

// ---------------------------------------------------------------------------
// Nickname color hash (same algorithm as game ChatMessage)
// ---------------------------------------------------------------------------

const NICKNAME_COLORS = [
  "text-amber-400",
  "text-emerald-400",
  "text-sky-400",
  "text-rose-400",
  "text-violet-400",
  "text-teal-400",
  "text-orange-400",
  "text-pink-400",
] as const;

function hashNickname(nickname: string): number {
  let hash = 0;
  for (let i = 0; i < nickname.length; i++) {
    hash = (hash * 31 + nickname.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getNicknameColor(nickname: string): string {
  return NICKNAME_COLORS[hashNickname(nickname) % NICKNAME_COLORS.length]!;
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  message: ChatMessageResponse;
  isMine: boolean;
}

function MessageBubble({ message, isMine }: MessageBubbleProps) {
  // System message
  if (message.message_type === "SYSTEM") {
    return (
      <div className="py-1 text-center text-xs italic text-slate-500">
        {message.content}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-0.5 ${isMine ? "items-end" : "items-start"}`}>
      {/* Sender nickname (only for others) */}
      {!isMine && (
        <span className={`text-xs font-semibold ${getNicknameColor(message.sender_nickname)}`}>
          {message.sender_nickname}
        </span>
      )}

      {/* Bubble */}
      <div
        className={`max-w-[75%] px-3.5 py-2 text-sm ${
          isMine
            ? "rounded-2xl rounded-br-sm bg-amber-600/20 text-amber-100"
            : "rounded-2xl rounded-bl-sm bg-slate-800 text-slate-100"
        }`}
      >
        {message.content}
      </div>

      {/* Timestamp */}
      <span className="text-[10px] text-slate-600">
        {formatMessageTime(message.created_at)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatRoom
// ---------------------------------------------------------------------------

interface ChatRoomProps {
  roomId: string;
}

export function ChatRoom({ roomId }: ChatRoomProps) {
  const [text, setText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentUser = useAuthStore((s) => s.user);
  const { data: messages, isLoading } = useChatMessages(roomId);
  const sendMessage = useSendMessage(roomId);
  const markAsRead = useMarkAsRead(roomId);

  // Auto-mark as read on mount & roomId change
  useEffect(() => {
    markAsRead.mutate(undefined);
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom on new messages
  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Auto-resize textarea
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_MESSAGE_LENGTH) {
      setText(value);
    }
    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sendMessage.isPending) return;

    sendMessage.mutate(
      { content: trimmed },
      {
        onSuccess: () => {
          setText("");
          if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
          }
        },
      },
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const charCount = text.length;
  const showCharCount = charCount >= MAX_MESSAGE_LENGTH * 0.8;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!messages || messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={<MessageCircle className="h-10 w-10" />}
              title="메시지가 없습니다"
              description="첫 메시지를 보내보세요"
            />
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isMine={currentUser?.id === msg.sender_id}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-slate-700 px-4 py-3">
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-colors focus:border-amber-500"
              rows={1}
              placeholder="메시지를 입력하세요..."
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              maxLength={MAX_MESSAGE_LENGTH}
            />
            {showCharCount && (
              <span
                className={`absolute bottom-1.5 right-2 text-[10px] ${
                  charCount >= MAX_MESSAGE_LENGTH ? "text-red-400" : "text-slate-500"
                }`}
              >
                {charCount}/{MAX_MESSAGE_LENGTH}
              </span>
            )}
          </div>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!text.trim() || sendMessage.isPending}
            isLoading={sendMessage.isPending}
            aria-label="메시지 보내기"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
