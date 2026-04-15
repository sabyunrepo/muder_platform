import { useState } from "react";
import { Lock } from "lucide-react";
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

const MAX_NICKNAME_LEN = 20;
const MAX_TEXT_LEN = 1000;

interface WhisperPayload {
  sender: string;
  nickname: string;
  targetId: string;
  text: string;
  ts: number;
}

export interface WhisperPanelProps {
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
// WhisperPanel
// ---------------------------------------------------------------------------

/**
 * Dedicated whisper-only chat panel.
 * Shares whisperMessages with GameChatPanel via gameChatStore.
 */
export function WhisperPanel({ send }: WhisperPanelProps) {
  const [inputText, setInputText] = useState("");
  const [whisperTarget, setWhisperTarget] = useState("");

  const players = useGameSessionStore((s) => s.players);
  const myPlayerId = useGameSessionStore((s) => s.myPlayerId);
  const otherPlayers = players.filter((p) => p.id !== myPlayerId);

  const whisperMessages = useGameChatStore((s) => s.whisperMessages);
  const addWhisperMessage = useGameChatStore((s) => s.addWhisperMessage);

  // ── WS subscription ──────────────────────────────────────────────────────

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
    if (!trimmed || !whisperTarget) return;
    send(WsEventType.CHAT_WHISPER, { targetId: whisperTarget, text: trimmed });
    setInputText("");
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col rounded-xl border border-purple-900/50 bg-slate-900">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2.5">
        <Lock className="h-4 w-4 text-purple-400" />
        <span className="text-sm font-semibold text-purple-300">귓속말</span>
      </div>

      {/* Target picker */}
      <WhisperTargetPicker
        players={otherPlayers}
        selected={whisperTarget}
        onSelect={setWhisperTarget}
      />

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4">
        <ChatMessageList
          messages={whisperMessages}
          emptyText="귓속말이 없습니다."
        />
      </div>

      {/* Input */}
      <ChatInput
        value={inputText}
        onChange={setInputText}
        onSend={handleSend}
        placeholder="귓속말을 입력하세요..."
        disabled={!inputText.trim() || !whisperTarget}
      />
    </div>
  );
}
