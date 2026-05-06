import type { WsEventType } from '@mmp/shared';
import type { ErrorPayload } from '@mmp/shared';

export interface WsClientOptions {
  /** WebSocket server URL (ws:// or wss://) */
  url: string;
  /**
   * Auth token.
   *
   * Appended to the URL as `?token=…` at connect time. The server validates
   * it at HTTP upgrade (rejects with 4xx on bad token). When
   * `authProtocol` is true the client also confirms identity post-open via
   * `auth.identify` and rotates the token via `auth.token_issued` on
   * successful `auth.refresh` — the in-memory current token then wins
   * over this initial value for subsequent reconnect URLs.
   */
  token?: string;
  /** Reconnect options */
  reconnect?: ReconnectOptions;
  /** Heartbeat interval in ms (default: 30000) */
  heartbeatInterval?: number;
  /** Called when an incoming message fails JSON parsing */
  onParseError?: (error: Error, raw: string) => void;
  /**
   * PR-9 WS Auth Protocol — when true the client automatically sends
   * `auth.identify` on first connect and `auth.resume` on reconnect (with
   * the most recent sessionId / lastSeq), and dispatches the four S→C
   * auth.* envelopes to the dedicated callbacks below. Defaults to false
   * so a flag-off rollout retains the legacy upgrade-only behaviour.
   */
  authProtocol?: boolean;
  /**
   * Called after a successful `auth.refresh` round-trip. The supplied
   * token has already replaced the in-memory current token used for
   * future reconnect URLs; consumers typically forward it to their token
   * storage (cookie / IndexedDB) so a hard reload picks it up.
   * `expiresAt` is the wire format from AuthTokenIssuedPayload — an
   * epoch-ms timestamp so the client can schedule the next refresh.
   */
  onTokenRefreshed?: (token: string, expiresAt: number) => void;
  /**
   * Called when the server sends `auth.refresh_required`, signalling
   * that the current access token is approaching expiry. Consumers
   * should call refreshToken() with their refresh token before expiresAt.
   */
  onRefreshRequired?: (expiresAt: number, reason?: string) => void;
  /**
   * Called when the server sends `auth.revoked` (ban / logout-elsewhere /
   * password change / admin revoke). The connection is closed and
   * reconnect is disabled — consumers typically navigate to a blocked
   * landing page.
   */
  onRevoked?: (code: string, reason: string) => void;
  /**
   * Called when the server sends `auth.invalid_session` with
   * `resumable=false`, signalling the user is fully unauthorized (not
   * just a stale resume target). Reconnect is disabled. resumable=true
   * cases are handled internally — the client drops sessionId/lastSeq
   * and falls back to a fresh `auth.identify` on the next connection.
   */
  onUnauthorized?: (reason: string) => void;
  /**
   * Called when the server sends the generic `error` frame. Fatal errors
   * disable reconnect before this callback is invoked.
   */
  onServerError?: (payload: ErrorPayload) => void;
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
  IDLE: 'idle',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  DISCONNECTED: 'disconnected',
} as const;

export type WsClientState = (typeof WsClientState)[keyof typeof WsClientState];

export type WsEventHandler<T = unknown> = (payload: T, seq: number) => void;
export type WsStateChangeHandler = (state: WsClientState) => void;

export interface WsClientEvents {
  [eventType: string]: WsEventHandler;
}

/** Internal listener record. */
export interface Listener {
  type: WsEventType | 'state:change';
  handler: WsEventHandler | WsStateChangeHandler;
}
