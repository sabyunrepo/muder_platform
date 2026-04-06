// ---------------------------------------------------------------------------
// Social Feature Constants
// ---------------------------------------------------------------------------

export type ChatRoomType = "DM" | "GROUP";
export type MessageType = "TEXT" | "SYSTEM" | "GAME_INVITE" | "GAME_RESULT";

export const MESSAGE_TYPE_LABEL: Record<MessageType, string> = {
  TEXT: "메시지",
  SYSTEM: "시스템",
  GAME_INVITE: "게임 초대",
  GAME_RESULT: "게임 결과",
};

export const MAX_MESSAGE_LENGTH = 2000;
export const CHAT_MESSAGE_LIMIT = 50;
export const FRIEND_LIST_LIMIT = 50;
