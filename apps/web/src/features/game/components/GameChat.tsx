import { useState, useRef, useEffect, useCallback } from "react";
import { Send, MessageCircle, Lock } from "lucide-react";
import type { WsEventType } from "@mmp/shared";
import { WsEventType as Events } from "@mmp/shared";
import { Button, Input } from "@/shared/components/ui";
import { useWsEvent } from "@/hooks/useWsEvent";
import { useGameStore } from "@/stores/gameStore";
import { ChatMessage } from "./ChatMessage";
import type { ChatMessageProps } from "./ChatMessage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** WS에서 수신하는 채팅 페이로드 */
interface ChatPayload {
  sender: string;
  nickname: string;
  text: string;
  ts: number;
}

/** WS에서 수신하는 귓속말 페이로드 */
interface WhisperPayload {
  sender: string;
  nickname: string;
  targetId: string;
  text: string;
  ts: number;
}

type TabType = "all" | "whisper";

interface GameChatProps {
  /** WS send 함수 */
  send: (type: WsEventType, payload: unknown) => void;
  /** discussion 페이즈에서 전체 너비로 표시 */
  fullWidth?: boolean;
}

// ---------------------------------------------------------------------------
// 메시지 상한
// ---------------------------------------------------------------------------

const MAX_MESSAGES = 500;
const MAX_NICKNAME_LEN = 20;
const MAX_TEXT_LEN = 1000;

/** WS 수신 메시지의 닉네임/텍스트 길이를 제한한다 */
function sanitizeChat(payload: { nickname: string; text: string }) {
  return {
    nickname: String(payload.nickname || "").slice(0, MAX_NICKNAME_LEN),
    text: String(payload.text || "").slice(0, MAX_TEXT_LEN),
  };
}

function appendMessage<T>(prev: T[], msg: T): T[] {
  const next = [...prev, msg];
  return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
}

// ---------------------------------------------------------------------------
// GameChat
// ---------------------------------------------------------------------------

export function GameChat({ send, fullWidth = false }: GameChatProps) {
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [messages, setMessages] = useState<ChatMessageProps[]>([]);
  const [whisperMessages, setWhisperMessages] = useState<ChatMessageProps[]>([]);
  const [inputText, setInputText] = useState("");
  const [whisperTarget, setWhisperTarget] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 스토어에서 플레이어 정보 가져오기
  const players = useGameStore((s) => s.players);
  const myPlayerId = useGameStore((s) => s.myPlayerId);

  // 자신을 제외한 플레이어 목록
  const otherPlayers = players.filter((p) => p.id !== myPlayerId);

  // 스크롤 하단 고정
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const currentMessages = activeTab === "all" ? messages : whisperMessages;

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, scrollToBottom]);

  // WS 이벤트 구독: 전체 채팅
  useWsEvent<ChatPayload>("game", Events.CHAT_MESSAGE, (payload) => {
    const { nickname, text } = sanitizeChat(payload);
    setMessages((prev) =>
      appendMessage(prev, {
        nickname,
        text,
        ts: payload.ts,
        isMine: payload.sender === myPlayerId,
      }),
    );
  });

  // WS 이벤트 구독: 귓속말
  useWsEvent<WhisperPayload>("game", Events.CHAT_WHISPER, (payload) => {
    const { nickname, text } = sanitizeChat(payload);
    setWhisperMessages((prev) =>
      appendMessage(prev, {
        nickname,
        text,
        ts: payload.ts,
        isWhisper: true,
        isMine: payload.sender === myPlayerId,
      }),
    );
  });

  /** 메시지 전송 */
  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    if (activeTab === "whisper") {
      // 귓속말: 대상 미선택 시 무시
      if (!whisperTarget) return;
      send(Events.CHAT_WHISPER, { targetId: whisperTarget, text: trimmed });
    } else {
      send(Events.CHAT_MESSAGE, { text: trimmed });
    }

    setInputText("");
  };

  /** Enter 키 전송 */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 전송 버튼 비활성화 조건
  const isSendDisabled =
    !inputText.trim() || (activeTab === "whisper" && !whisperTarget);

  return (
    <div className={`flex flex-col bg-slate-900 ${fullWidth ? "h-full" : "h-full rounded-xl border border-slate-800"}`}>
      {/* 탭 헤더 */}
      <div className="flex border-b border-slate-800">
        <button
          type="button"
          className={`flex flex-1 items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "all"
              ? "border-b-2 border-amber-500 text-amber-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
          onClick={() => setActiveTab("all")}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          전체
        </button>
        <button
          type="button"
          className={`flex flex-1 items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "whisper"
              ? "border-b-2 border-purple-500 text-purple-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
          onClick={() => setActiveTab("whisper")}
        >
          <Lock className="h-3.5 w-3.5" />
          귓속말
        </button>
      </div>

      {/* 귓속말 대상 선택 */}
      {activeTab === "whisper" && (
        <div className="border-b border-slate-800 px-3 py-2">
          <select
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-purple-500"
            value={whisperTarget}
            onChange={(e) => setWhisperTarget(e.target.value)}
          >
            <option value="">대상 선택...</option>
            {otherPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nickname}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4">
        {currentMessages.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            아직 메시지가 없습니다.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {currentMessages.map((msg, i) => (
              <ChatMessage
                key={`${msg.nickname}-${msg.ts}-${i}`}
                {...msg}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 입력 폼 */}
      <div className="flex items-center gap-2 border-t border-slate-800 p-3">
        <div className="flex-1">
          <Input
            placeholder={
              activeTab === "whisper" ? "귓속말을 입력하세요..." : "메시지를 입력하세요..."
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={handleSend}
          disabled={isSendDisabled}
          aria-label="메시지 전송"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
