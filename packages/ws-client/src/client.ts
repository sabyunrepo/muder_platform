import {
  WsEventType as Events,
  type WsMessage,
  type WsEventType,
  type AuthIdentifyPayload,
  type AuthResumePayload,
  type AuthRefreshPayload,
  type AuthRevokedPayload,
  type AuthTokenIssuedPayload,
  type AuthInvalidSessionPayload,
  type ConnectedPayload,
  type ErrorPayload,
} from '@mmp/shared';
import { ReconnectManager } from './reconnect.js';
import {
  WsClientState,
  type WsClientOptions,
  type WsEventHandler,
  type WsStateChangeHandler,
} from './types.js';

/**
 * WebSocket client with heartbeat + reconnect + typed event dispatch.
 *
 * Auth model:
 *
 *   1. Initial connect — `?token=…` query parameter validated by the
 *      server at HTTP upgrade. Upgrade success implies the connection
 *      is authenticated.
 *   2. (PR-9, opt-in via `authProtocol: true`) Post-open the client
 *      confirms identity with `auth.identify`, or reconnects with
 *      `auth.resume` if it knows the previous sessionId / lastSeq.
 *      The client also dispatches the four S→C `auth.*` envelopes
 *      (`auth.revoked`, `auth.invalid_session`, `auth.token_issued`,
 *      `auth.refresh_required`) to the dedicated callbacks so the
 *      consuming app does not have to subscribe to them as ordinary
 *      events.
 *
 * `authProtocol` defaults to false so a flag-off rollout retains the
 * legacy upgrade-only behaviour.
 */
export class WsClient {
  private ws: WebSocket | null = null;
  private seq = 0;
  private state: WsClientState = WsClientState.IDLE;
  private readonly options: Required<Pick<WsClientOptions, 'heartbeatInterval'>> & WsClientOptions;
  private readonly reconnect: ReconnectManager;
  private readonly listeners = new Map<string, Set<WsEventHandler>>();
  private readonly stateListeners = new Set<WsStateChangeHandler>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  // PR-9 resume bookkeeping. sessionId is captured from the first
  // `connected` envelope; lastSeq tracks the most recent envelope seq
  // observed so a reconnect can request replay from there. currentToken
  // wins over options.token for reconnect URLs once a refresh has
  // rotated it.
  private sessionId: string | undefined;
  private lastSeq: number | undefined;
  private currentToken: string | undefined;

  constructor(options: WsClientOptions) {
    this.options = { heartbeatInterval: 30_000, ...options };
    this.reconnect = new ReconnectManager(options.reconnect);
    this.currentToken = options.token;
  }

  /** Current connection state. */
  get connectionState(): WsClientState {
    return this.state;
  }

  /** Connect to the WebSocket server. */
  connect(): void {
    if (this.state === WsClientState.CONNECTED || this.state === WsClientState.CONNECTING) {
      return;
    }
    this.setState(WsClientState.CONNECTING);
    this.ws = new WebSocket(buildUrl(this.options.url, this.currentToken));
    this.ws.onopen = this.handleOpen;
    this.ws.onclose = this.handleClose;
    this.ws.onmessage = this.handleMessage;
    this.ws.onerror = this.handleError;
  }

  /** Disconnect from the server. */
  disconnect(): void {
    this.reconnect.cancel();
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.onclose = null; // suppress reconnect on intentional close
      this.ws.close(1000, 'client disconnect');
      this.ws = null;
    }
    this.setState(WsClientState.DISCONNECTED);
  }

  /** Send a typed message. Throws if the socket is not CONNECTED. */
  send<T>(type: WsEventType, payload: T): void {
    if (this.state !== WsClientState.CONNECTED || !this.ws) {
      throw new Error(`Cannot send in state: ${this.state}`);
    }
    const message: WsMessage<T> = {
      type,
      payload,
      ts: Date.now(),
      seq: this.seq++,
    };
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Request a token rotation via `auth.refresh`. Caller supplies the
   * refresh token (typically read from secure storage); the response
   * arrives as `auth.token_issued` and is funneled through
   * onTokenRefreshed. Throws if the socket is not CONNECTED or
   * authProtocol is false.
   */
  refreshToken(refreshToken: string): void {
    if (!this.options.authProtocol) {
      throw new Error('refreshToken requires authProtocol: true');
    }
    const payload: AuthRefreshPayload = { token: refreshToken };
    this.send(Events.AUTH_REFRESH, payload);
  }

  /** Subscribe to a specific event type. */
  on<T = unknown>(type: WsEventType, handler: WsEventHandler<T>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(handler as WsEventHandler);
    return () => this.off(type, handler);
  }

  /** Unsubscribe from an event type. */
  off<T = unknown>(type: WsEventType, handler: WsEventHandler<T>): void {
    const set = this.listeners.get(type);
    if (set) {
      set.delete(handler as WsEventHandler);
      if (set.size === 0) this.listeners.delete(type);
    }
  }

  /** Subscribe to connection state changes. */
  onStateChange(handler: WsStateChangeHandler): () => void {
    this.stateListeners.add(handler);
    return () => this.stateListeners.delete(handler);
  }

  // --- Private ---

  private setState(state: WsClientState): void {
    if (this.state === state) return;
    this.state = state;
    for (const handler of this.stateListeners) {
      handler(state);
    }
  }

  private emit(type: WsEventType, payload: unknown, seq: number): void {
    const set = this.listeners.get(type);
    if (set) {
      for (const handler of set) handler(payload, seq);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.state === WsClientState.CONNECTED) {
        this.send(Events.PING, null);
      }
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private readonly handleOpen = (): void => {
    this.reconnect.reset();
    this.setState(WsClientState.CONNECTED);
    this.startHeartbeat();
    this.maybeSendAuthGreeting();
    // A `connected` envelope arrives next carrying { playerId, sessionId,
    // seq } and is captured in handleMessage so the next reconnect can
    // resume from the right offset.
  };

  /**
   * PR-9 — automatically send the post-open auth greeting when
   * authProtocol is enabled. First connect (no sessionId yet) sends
   * auth.identify; subsequent reconnects with a known sessionId send
   * auth.resume. When authProtocol is false this is a no-op and the
   * legacy upgrade-only auth path remains in effect.
   */
  private maybeSendAuthGreeting(): void {
    if (!this.options.authProtocol) return;
    const token = this.currentToken ?? '';
    if (this.sessionId !== undefined && this.lastSeq !== undefined) {
      const payload: AuthResumePayload = {
        token,
        sessionId: this.sessionId,
        lastSeq: this.lastSeq,
      };
      this.send(Events.AUTH_RESUME, payload);
    } else {
      const payload: AuthIdentifyPayload = { token };
      this.send(Events.AUTH_IDENTIFY, payload);
    }
  }

  private readonly handleClose = (_event: CloseEvent): void => {
    this.stopHeartbeat();
    this.ws = null;
    if (this.reconnect.isEnabled && this.reconnect.canRetry) {
      this.setState(WsClientState.RECONNECTING);
      this.reconnect.schedule(() => this.connect());
    } else {
      this.setState(WsClientState.DISCONNECTED);
    }
  };

  private readonly handleMessage = (event: MessageEvent): void => {
    const raw = String(event.data);
    let message: WsMessage;
    try {
      message = JSON.parse(raw) as WsMessage;
    } catch (err) {
      if (this.options.onParseError) {
        this.options.onParseError(err instanceof Error ? err : new Error(String(err)), raw);
      } else {
        console.warn('[WsClient] Failed to parse message:', err);
      }
      return;
    }

    // Track lastSeq for the next resume attempt — every server-stamped
    // envelope carries a monotonically increasing seq.
    if (typeof message.seq === 'number') {
      this.lastSeq = message.seq;
    }

    // Capture sessionId from the initial `connected` envelope so a
    // reconnect can ask the server to replay buffered events.
    if (message.type === Events.CONNECTED) {
      const payload = message.payload as Partial<ConnectedPayload> | undefined;
      if (payload?.sessionId) {
        this.sessionId = payload.sessionId;
      }
    }

    // PR-9 auth.* dispatch — these never reach the regular emit path
    // because consumers register dedicated callbacks instead.
    if (this.handleAuthFrame(message)) {
      return;
    }

    if (message.type === Events.ERROR) {
      const payload = message.payload as ErrorPayload;
      if (payload.fatal) {
        this.reconnect.disable();
      }
      this.options.onServerError?.(payload);
      return;
    }

    // Silently swallow pong heartbeat replies.
    if (message.type === Events.PONG) return;
    this.emit(message.type, message.payload, message.seq);
  };

  /**
   * Inspect a message for an S→C auth.* envelope and route it to the
   * corresponding callback. Returns true when the frame was handled
   * (caller must skip the regular emit path) and false otherwise.
   */
  private handleAuthFrame(message: WsMessage): boolean {
    switch (message.type) {
      case Events.AUTH_TOKEN_ISSUED: {
        const payload = message.payload as AuthTokenIssuedPayload;
        this.currentToken = payload.token;
        this.options.onTokenRefreshed?.(payload.token, payload.expiresAt);
        return true;
      }
      case Events.AUTH_REVOKED: {
        const payload = message.payload as AuthRevokedPayload;
        this.options.onRevoked?.(payload.code, payload.reason);
        // Server is closing this socket; suppress reconnect so the user
        // does not bounce back into the revoked state.
        this.reconnect.disable();
        return true;
      }
      case Events.AUTH_INVALID_SESSION: {
        const payload = message.payload as AuthInvalidSessionPayload;
        if (payload.resumable) {
          // The user is still valid but the resume target is gone (buffer
          // expired, sessionId stale). Drop bookkeeping so the next
          // handleOpen falls back to auth.identify on a fresh connection.
          this.sessionId = undefined;
          this.lastSeq = undefined;
        } else {
          this.options.onUnauthorized?.(payload.reason);
          this.reconnect.disable();
        }
        return true;
      }
      default:
        return false;
    }
  }

  private readonly handleError = (_event: Event): void => {
    // onerror always precedes onclose; handleClose drives state transitions.
  };
}

/**
 * Append `?token=…` to the URL unless the caller already placed one.
 * Explicit query-string tokens win so callers can override for tests.
 */
function buildUrl(url: string, token: string | undefined): string {
  if (!token) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has('token')) u.searchParams.set('token', token);
    return u.toString();
  } catch {
    // Relative or otherwise non-parseable URL — fall back to raw.
    return url;
  }
}
