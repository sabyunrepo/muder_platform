import type { WsEventType } from "@mmp/shared";

// ---------------------------------------------------------------------------
// GameChat — shared types and constants
// ---------------------------------------------------------------------------

/** WS에서 수신하는 채팅 페이로드 */
export interface ChatPayload {
  sender: string;
  nickname: string;
  text: string;
  ts: number;
}

/** WS에서 수신하는 귓속말 페이로드 */
export interface WhisperPayload {
  sender: string;
  nickname: string;
  targetId: string;
  text: string;
  ts: number;
}

/** 그룹 정보 */
export interface GroupInfo {
  id: string;
  name: string;
  members: string[];
}

/** 그룹 메시지 페이로드 */
export interface GroupMessagePayload {
  groupId: string;
  senderId: string;
  senderName: string;
  text: string;
  ts: number;
}

/** group_chat 모듈 스토어 데이터 형태 */
export interface GroupChatData {
  groups?: GroupInfo[];
  groupMessages?: Record<string, GroupMessagePayload[]>;
}

export type TabType = "all" | "whisper" | "group";

export interface GameChatProps {
  /** WS send 함수 */
  send: (type: WsEventType, payload: unknown) => void;
  /** discussion 페이즈에서 전체 너비로 표시 */
  fullWidth?: boolean;
}

// ---------------------------------------------------------------------------
// 메시지 상한
// ---------------------------------------------------------------------------

export const MAX_MESSAGES = 500;
export const MAX_NICKNAME_LEN = 20;
export const MAX_TEXT_LEN = 1000;

/** WS 수신 메시지의 닉네임/텍스트 길이를 제한한다 */
export function sanitizeChat(payload: { nickname: string; text: string }) {
  return {
    nickname: String(payload.nickname || "").slice(0, MAX_NICKNAME_LEN),
    text: String(payload.text || "").slice(0, MAX_TEXT_LEN),
  };
}

export function appendMessage<T>(prev: T[], msg: T): T[] {
  const next = [...prev, msg];
  return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
}
