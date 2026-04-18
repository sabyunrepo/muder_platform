import { useState, useRef, useEffect, useCallback } from "react";
import { Send, MessageCircle, Gamepad2, Trophy } from "lucide-react";
import { Button, Spinner, EmptyState } from "@/shared/components/ui";
import {
  useChatMessages,
  useSendMessage,
  useMarkAsRead,
} from "@/features/social/api";
import type { ChatMessageResponse } from "@/features/social/api";
import { useAuthStore } from "@/stores/authStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { useSocialStore, selectRoomTypingUsers } from "@/stores/socialStore";
import { MAX_MESSAGE_LENGTH } from "@/features/social/constants";

// ---------------------------------------------------------------------------
// Nickname color hash (same algorithm as game ChatMessage)
// ---------------------------------------------------------------------------

import { getNicknameColor } from "@/shared/utils/nickname";

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

  // Game invite card
  if (message.message_type === "GAME_INVITE") {
    return (
      <div className={`flex flex-col gap-0.5 ${isMine ? "items-end" : "items-start"}`}>
        {!isMine && (
          <span className={`text-xs font-semibold ${getNicknameColor(message.sender_nickname)}`}>
            {message.sender_nickname}
          </span>
        )}
        <div className="max-w-[75%] rounded-xl border border-amber-700/50 bg-amber-900/20 p-3">
          <div className="flex items-center gap-2 text-amber-400">
            <Gamepad2 className="h-4 w-4" />
            <span className="text-sm font-semibold">게임 초대</span>
          </div>
          <p className="mt-1 text-sm text-slate-300">{message.content}</p>
        </div>
        <span className="text-[10px] text-slate-600">
          {formatMessageTime(message.created_at)}
        </span>
      </div>
    );
  }

  // Game result card
  if (message.message_type === "GAME_RESULT") {
    return (
      <div className={`flex flex-col gap-0.5 ${isMine ? "items-end" : "items-start"}`}>
        {!isMine && (
          <span className={`text-xs font-semibold ${getNicknameColor(message.sender_nickname)}`}>
            {message.sender_nickname}
          </span>
        )}
        <div className="max-w-[75%] rounded-xl border border-emerald-700/50 bg-emerald-900/20 p-3">
          <div className="flex items-center gap-2 text-emerald-400">
            <Trophy className="h-4 w-4" />
            <span className="text-sm font-semibold">게임 결과</span>
          </div>
          <p className="mt-1 text-sm text-slate-300">{message.content}</p>
        </div>
        <span className="text-[10px] text-slate-600">
          {formatMessageTime(message.created_at)}
        </span>
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
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentUser = useAuthStore((s) => s.user);
  const socialClient = useConnectionStore((s) => s.socialClient);
  const typingUsers = useSocialStore(selectRoomTypingUsers(roomId));
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

  // Send typing indicator (debounced)
  const sendTypingEvent = useCallback(() => {
    if (!socialClient) return;
    if (typingTimerRef.current) return; // Already sent recently
    socialClient.send("chat:typing" as any, { room_id: roomId });
    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
    }, 300);
  }, [socialClient, roomId]);

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
    // Send typing indicator
    if (value.trim()) {
      sendTypingEvent();
    }
  }, [sendTypingEvent]);

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

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-1">
          <span className="text-xs text-slate-500 animate-pulse">
            입력 중...
          </span>
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-slate-700 px-4 py-3">
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 transition-colors focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
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
