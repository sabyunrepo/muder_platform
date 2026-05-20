import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { Send } from "lucide-react";
import { WsEventType } from "@mmp/shared";
import { Button, Input, Panel } from "@/shared/components/ui";
import { useWsEvent } from "@/hooks/useWsEvent";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 채팅 메시지 */
interface ChatMessage {
  sender: string;
  nickname: string;
  text: string;
  ts: number;
}

interface RoomChatProps {
  roomId: string;
  /** WS send 함수 */
  send: <T>(type: string, payload: T) => void;
  headerActions?: ReactNode;
}

// ---------------------------------------------------------------------------
// RoomChat
// ---------------------------------------------------------------------------

export function RoomChat({ roomId, send, headerActions }: RoomChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 스크롤 하단 고정
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // WS 이벤트 구독: 채팅 메시지 수신
  useWsEvent<ChatMessage>("game", WsEventType.CHAT_MESSAGE, (payload) => {
    setMessages((prev) => {
      const next = [...prev, payload];
      return next.length > 500 ? next.slice(-500) : next;
    });
  });

  /** 메시지 전송 */
  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    send(WsEventType.CHAT_SEND, { room_id: roomId, text: trimmed });
    setInputText("");
  };

  /** Enter 키 전송 */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Panel padding="none" className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-col items-stretch gap-3 border-b border-[var(--mmp-color-hairline)] p-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 sm:flex-1">
          <h2 className="text-base font-semibold text-[var(--mmp-color-ink)]">대기방 채팅</h2>
          <p className="mt-1 break-words text-xs text-[var(--mmp-color-steel)]">
            음성 상태를 보면서 메시지를 주고받습니다.
          </p>
        </div>
        {headerActions && <div className="min-w-0 max-w-full sm:w-auto">{headerActions}</div>}
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--mmp-color-steel)]">
            아직 메시지가 없습니다.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((msg, i) => (
              <div key={`${msg.sender}-${msg.ts}-${i}`} className="flex min-w-0 flex-col">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="min-w-0 max-w-[70%] truncate text-xs font-semibold text-[var(--mmp-color-primary)]">
                    {msg.nickname}
                  </span>
                  <span className="shrink-0 text-[10px] text-[var(--mmp-color-steel)]">
                    {new Date(msg.ts).toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="break-words text-sm text-[var(--mmp-color-charcoal)]">{msg.text}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 입력 폼 */}
      <div className="flex items-center gap-2 border-t border-[var(--mmp-color-hairline)] p-3">
        <div className="min-w-0 flex-1">
          <Input
            placeholder="메시지를 입력하세요..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={handleSend}
          disabled={!inputText.trim()}
          aria-label="메시지 전송"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Panel>
  );
}
