/** WebSocket message envelope shared between Go server and TS clients. */
export interface WsMessage<T = unknown> {
  type: WsEventType;
  payload: T;
  ts: number;
  seq: number;
}

/** All WebSocket event types. Matches Go server's event registry. */
export const WsEventType = {
  // Connection
  PING: "ping",
  PONG: "pong",
  AUTH: "auth",
  AUTH_OK: "auth:ok",
  AUTH_FAIL: "auth:fail",
  ERROR: "error",

  // Session
  SESSION_JOIN: "session:join",
  SESSION_LEAVE: "session:leave",
  SESSION_STATE: "session:state",
  SESSION_PLAYER_JOINED: "session:player:joined",
  SESSION_PLAYER_LEFT: "session:player:left",

  // Game
  GAME_START: "game:start",
  GAME_END: "game:end",
  GAME_PHASE_CHANGE: "game:phase:change",
  GAME_ACTION: "game:action",
  GAME_ACTION_RESULT: "game:action:result",

  // Chat
  CHAT_MESSAGE: "chat:message",
  CHAT_WHISPER: "chat:whisper",

  // Voice
  VOICE_TOKEN: "voice:token",
  VOICE_STATE: "voice:state",

  // Module
  MODULE_EVENT: "module:event",
  MODULE_STATE: "module:state",
} as const;

export type WsEventType = (typeof WsEventType)[keyof typeof WsEventType];
