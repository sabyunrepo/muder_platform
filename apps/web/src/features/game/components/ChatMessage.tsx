import { memo } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessageProps {
  nickname: string;
  text: string;
  ts: number;
  isWhisper?: boolean;
  isGroup?: boolean;
  isSystem?: boolean;
  isMine?: boolean;
}

// ---------------------------------------------------------------------------
// 닉네임 색상 해시
// ---------------------------------------------------------------------------

import { getNicknameColor } from "@/shared/utils/nickname";

// ---------------------------------------------------------------------------
// 시간 포맷
// ---------------------------------------------------------------------------

/** timestamp → HH:MM 포맷 */
function formatTime(ts: number): string {
  const date = new Date(ts);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

// ---------------------------------------------------------------------------
// ChatMessage
// ---------------------------------------------------------------------------

export const ChatMessage = memo(function ChatMessage({
  nickname,
  text,
  ts,
  isWhisper = false,
  isGroup = false,
  isSystem = false,
  isMine = false,
}: ChatMessageProps) {
  // 시스템 메시지
  if (isSystem) {
    return (
      <div className="py-0.5 text-center text-xs italic text-slate-500">
        {text}
      </div>
    );
  }

  // 귓속말 메시지
  if (isWhisper) {
    return (
      <div
        className={`flex flex-col rounded border-l-2 border-purple-500 bg-purple-900/30 px-3 py-1.5 ${isMine ? "items-end" : "items-start"}`}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-medium text-purple-400">
            귓속말
          </span>
          <span className={`text-xs font-semibold ${getNicknameColor(nickname)}`}>
            {nickname}
          </span>
          <span className="text-[10px] text-slate-600">{formatTime(ts)}</span>
        </div>
        <p className="text-sm text-purple-200">{text}</p>
      </div>
    );
  }

  // 그룹 메시지
  if (isGroup) {
    return (
      <div
        className={`flex flex-col rounded border-l-2 border-teal-500 bg-teal-900/20 px-3 py-1.5 ${isMine ? "items-end" : "items-start"}`}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-medium text-teal-400">
            그룹
          </span>
          <span className={`text-xs font-semibold ${getNicknameColor(nickname)}`}>
            {nickname}
          </span>
          <span className="text-[10px] text-slate-600">{formatTime(ts)}</span>
        </div>
        <p className="text-sm text-teal-200">{text}</p>
      </div>
    );
  }

  // 일반 메시지
  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      <div className="flex items-baseline gap-2">
        <span className={`text-xs font-semibold ${getNicknameColor(nickname)}`}>
          {nickname}
        </span>
        <span className="text-[10px] text-slate-600">{formatTime(ts)}</span>
      </div>
      <p className={`text-sm text-slate-200 ${isMine ? "text-right" : ""}`}>
        {text}
      </p>
    </div>
  );
});
