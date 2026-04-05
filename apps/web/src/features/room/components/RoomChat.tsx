import { useState, useRef, useEffect, useCallback } from "react";
import { Send } from "lucide-react";
import { Button, Input } from "@/shared/components/ui";
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
  /** WS send 함수 */
  send: <T>(type: string, payload: T) => void;
}

// ---------------------------------------------------------------------------
// RoomChat
// ---------------------------------------------------------------------------

export function RoomChat({ send }: RoomChatProps) {
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
  useWsEvent<ChatMessage>("game", "chat:message", (payload) => {
    setMessages((prev) => {
      const next = [...prev, payload];
      return next.length > 500 ? next.slice(-500) : next;
    });
  });

  /** 메시지 전송 */
  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    send("chat:message", { text: trimmed });
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
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900">
      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            아직 메시지가 없습니다.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((msg, i) => (
              <div key={`${msg.sender}-${msg.ts}-${i}`} className="flex flex-col">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-amber-400">
                    {msg.nickname}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    {new Date(msg.ts).toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm text-slate-200">{msg.text}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 입력 폼 */}
      <div className="flex items-center gap-2 border-t border-slate-800 p-3">
        <div className="flex-1">
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
    </div>
  );
}
