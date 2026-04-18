import type { WsMessage, WsEventType } from "@mmp/shared";
import { WsEventType as Events } from "@mmp/shared";
import { ReconnectManager } from "./reconnect.js";
import {
  WsClientState,
  type WsClientOptions,
  type WsEventHandler,
  type WsStateChangeHandler,
} from "./types.js";

/**
 * WebSocket client with heartbeat + reconnect + typed event dispatch.
 *
 * Auth model (Phase 19 PR-1 / D2 decision): the server validates the
 * `?token=…` query parameter at HTTP upgrade. Upgrade success implies the
 * connection is authenticated; there is no post-open AUTH handshake.
 * A refresh / revoke / challenge protocol is reserved for PR-9
 * (see envelope_catalog_system.go `auth.*` stub entries).
 */
export class WsClient {
  private ws: WebSocket | null = null;
  private seq = 0;
  private state: WsClientState = WsClientState.IDLE;
  private readonly options: Required<
    Pick<WsClientOptions, "heartbeatInterval">
  > &
    WsClientOptions;
  private readonly reconnect: ReconnectManager;
  private readonly listeners = new Map<string, Set<WsEventHandler>>();
  private readonly stateListeners = new Set<WsStateChangeHandler>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: WsClientOptions) {
    this.options = { heartbeatInterval: 30_000, ...options };
    this.reconnect = new ReconnectManager(options.reconnect);
  }

  /** Current connection state. */
  get connectionState(): WsClientState {
    return this.state;
  }

  /** Connect to the WebSocket server. */
  connect(): void {
    if (
      this.state === WsClientState.CONNECTED ||
      this.state === WsClientState.CONNECTING
    ) {
      return;
    }
    this.setState(WsClientState.CONNECTING);
    this.ws = new WebSocket(buildUrl(this.options.url, this.options.token));
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
      this.ws.close(1000, "client disconnect");
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
    // Query-token auth happens at upgrade — nothing to send here.
    // The first server frame is a `connected` envelope carrying
    // { playerId, sessionId, seq } and is surfaced via on(Events.CONNECTED).
  };

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
        this.options.onParseError(
          err instanceof Error ? err : new Error(String(err)),
          raw,
        );
      } else {
        console.warn("[WsClient] Failed to parse message:", err);
      }
      return;
    }
    // Silently swallow pong heartbeat replies.
    if (message.type === Events.PONG) return;
    this.emit(message.type, message.payload, message.seq);
  };

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
    if (!u.searchParams.has("token")) u.searchParams.set("token", token);
    return u.toString();
  } catch {
    // Relative or otherwise non-parseable URL — fall back to raw.
    return url;
  }
}
