import type { WsEventType } from "@mmp/shared";

export interface WsClientOptions {
  /** WebSocket server URL (ws:// or wss://) */
  url: string;
  /**
   * Auth token.
   *
   * Appended to the URL as `?token=…` at connect time. MMP v3 authenticates
   * at HTTP upgrade (server rejects with 4xx on bad token); no post-open
   * AUTH handshake. See Phase 19 PR-1 / PR-9 WS Auth Protocol (follow-up)
   * for the refresh + revoke roadmap.
   */
  token?: string;
  /** Reconnect options */
  reconnect?: ReconnectOptions;
  /** Heartbeat interval in ms (default: 30000) */
  heartbeatInterval?: number;
  /** Called when an incoming message fails JSON parsing */
  onParseError?: (error: Error, raw: string) => void;
}

export interface ReconnectOptions {
  /** Enable auto-reconnect (default: true) */
  enabled?: boolean;
  /** Max reconnect attempts (default: 5) */
  maxAttempts?: number;
  /** Base delay in ms (default: 1000) */
  baseDelay?: number;
  /** Max delay in ms (default: 30000) */
  maxDelay?: number;
}

export const WsClientState = {
  IDLE: "idle",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  RECONNECTING: "reconnecting",
  DISCONNECTED: "disconnected",
} as const;

export type WsClientState =
  (typeof WsClientState)[keyof typeof WsClientState];

export type WsEventHandler<T = unknown> = (payload: T, seq: number) => void;
export type WsStateChangeHandler = (state: WsClientState) => void;

export interface WsClientEvents {
  [eventType: string]: WsEventHandler;
}

/** Internal listener record. */
export interface Listener {
  type: WsEventType | "state:change";
  handler: WsEventHandler | WsStateChangeHandler;
}
