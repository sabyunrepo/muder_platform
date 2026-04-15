import { useState } from "react";
import { MessageCircle, Lock } from "lucide-react";
import { WsEventType } from "@mmp/shared";
import type { WsEventType as WsEventTypeT } from "@mmp/shared";

import { useWsEvent } from "@/hooks/useWsEvent";
import { useGameSessionStore } from "@/stores/gameSessionStore";
import { useGameChatStore } from "@/stores/gameChatStore";

import { ChatMessageList } from "./ChatMessageList";
import { ChatInput } from "./ChatInput";
import { WhisperTargetPicker } from "./WhisperTargetPicker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabType = "all" | "whisper";

const MAX_NICKNAME_LEN = 20;
const MAX_TEXT_LEN = 1000;

interface ChatPayload {
  sender: string;
  nickname: string;
  text: string;
  ts: number;
}

interface WhisperPayload {
  sender: string;
  nickname: string;
  targetId: string;
  text: string;
  ts: number;
}

export interface GameChatPanelProps {
  send: <T>(type: WsEventTypeT, payload: T) => void;
}

// ---------------------------------------------------------------------------
// Sanitise incoming WS text
// ---------------------------------------------------------------------------

function sanitise(payload: { nickname: string; text: string }) {
  return {
    nickname: String(payload.nickname ?? "").slice(0, MAX_NICKNAME_LEN),
    text: String(payload.text ?? "").slice(0, MAX_TEXT_LEN),
  };
}

// ---------------------------------------------------------------------------
// GameChatPanel
// ---------------------------------------------------------------------------

/**
 * In-game chat panel — 전체 채팅 (all) + 귓속말 (whisper) tabs.
 * Receives the WS `send` function from the parent game session component.
 */
export function GameChatPanel({ send }: GameChatPanelProps) {
  const [tab, setTab] = useState<TabType>("all");
  const [inputText, setInputText] = useState("");
  const [whisperTarget, setWhisperTarget] = useState("");

  const players = useGameSessionStore((s) => s.players);
  const myPlayerId = useGameSessionStore((s) => s.myPlayerId);
  const otherPlayers = players.filter((p) => p.id !== myPlayerId);

  const messages = useGameChatStore((s) => s.messages);
  const whisperMessages = useGameChatStore((s) => s.whisperMessages);
  const addMessage = useGameChatStore((s) => s.addMessage);
  const addWhisperMessage = useGameChatStore((s) => s.addWhisperMessage);

  // ── WS subscriptions ────────────────────────────────────────────────────

  useWsEvent<ChatPayload>("game", WsEventType.CHAT_MESSAGE, (payload) => {
    const { nickname, text } = sanitise(payload);
    addMessage({
      id: `${payload.sender}-${payload.ts}`,
      senderId: payload.sender,
      nickname,
      text,
      ts: payload.ts,
      isMine: payload.sender === myPlayerId,
    });
  });

  useWsEvent<WhisperPayload>("game", WsEventType.CHAT_WHISPER, (payload) => {
    const { nickname, text } = sanitise(payload);
    addWhisperMessage({
      id: `w-${payload.sender}-${payload.ts}`,
      senderId: payload.sender,
      nickname,
      text,
      ts: payload.ts,
      isWhisper: true,
      isMine: payload.sender === myPlayerId,
    });
  });

  // ── Send handler ─────────────────────────────────────────────────────────

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    if (tab === "whisper") {
      if (!whisperTarget) return;
      send(WsEventType.CHAT_WHISPER, { targetId: whisperTarget, text: trimmed });
    } else {
      send(WsEventType.CHAT_MESSAGE, { text: trimmed });
    }

    setInputText("");
  };

  const isSendDisabled = !inputText.trim() || (tab === "whisper" && !whisperTarget);
  const currentMessages = tab === "all" ? messages : whisperMessages;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900">
      {/* Tab header */}
      <div className="flex border-b border-slate-800">
        <button
          type="button"
          className={`flex flex-1 items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === "all"
              ? "border-b-2 border-amber-500 text-amber-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
          onClick={() => setTab("all")}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          전체
        </button>
        <button
          type="button"
          className={`flex flex-1 items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === "whisper"
              ? "border-b-2 border-purple-500 text-purple-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
          onClick={() => setTab("whisper")}
        >
          <Lock className="h-3.5 w-3.5" />
          귓속말
        </button>
      </div>

      {/* Whisper target picker */}
      {tab === "whisper" && (
        <WhisperTargetPicker
          players={otherPlayers}
          selected={whisperTarget}
          onSelect={setWhisperTarget}
        />
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4">
        <ChatMessageList
          messages={currentMessages}
          emptyText={
            tab === "whisper"
              ? "귓속말이 없습니다."
              : "아직 메시지가 없습니다."
          }
        />
      </div>

      {/* Input */}
      <ChatInput
        value={inputText}
        onChange={setInputText}
        onSend={handleSend}
        placeholder={
          tab === "whisper" ? "귓속말을 입력하세요..." : "메시지를 입력하세요..."
        }
        disabled={isSendDisabled}
      />
    </div>
  );
}
