import type { WsMessage, WsEventType } from "@mmp/shared";
import { WsEventType as Events } from "@mmp/shared";
import { ReconnectManager } from "./reconnect.js";
import {
  WsClientState,
  type WsClientOptions,
  type WsEventHandler,
  type WsStateChangeHandler,
} from "./types.js";

export class WsClient {
  private ws: WebSocket | null = null;
  private seq = 0;
  private state: WsClientState = WsClientState.IDLE;
  private authenticated = false;
  private readonly pendingQueue: Array<{ type: WsEventType; payload: unknown }> =
    [];
  private readonly options: Required<
    Pick<WsClientOptions, "heartbeatInterval">
  > &
    WsClientOptions;
  private readonly reconnect: ReconnectManager;
  private readonly listeners = new Map<string, Set<WsEventHandler>>();
  private readonly stateListeners = new Set<WsStateChangeHandler>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: WsClientOptions) {
    this.options = {
      heartbeatInterval: 30_000,
      ...options,
    };
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
    this.authenticated = false;

    this.ws = new WebSocket(this.options.url);
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
      this.ws.onclose = null; // prevent reconnect on intentional close
      this.ws.close(1000, "client disconnect");
      this.ws = null;
    }
    this.setState(WsClientState.DISCONNECTED);
  }

  /** Send a typed message. Queues messages until authentication completes. */
  send<T>(type: WsEventType, payload: T): void {
    if (this.state !== WsClientState.CONNECTED || !this.ws) {
      throw new Error(`Cannot send in state: ${this.state}`);
    }

    // Queue non-auth messages until authenticated
    if (!this.authenticated && type !== Events.AUTH) {
      this.pendingQueue.push({ type, payload });
      return;
    }

    this.sendRaw(type, payload);
  }

  /** Send a message immediately without auth gating. */
  private sendRaw<T>(type: WsEventType, payload: T): void {
    if (!this.ws) return;
    const message: WsMessage<T> = {
      type,
      payload,
      ts: Date.now(),
      seq: this.seq++,
    };
    this.ws.send(JSON.stringify(message));
  }

  /** Flush all queued messages after authentication. */
  private flushPendingQueue(): void {
    while (this.pendingQueue.length > 0) {
      const msg = this.pendingQueue.shift()!;
      this.sendRaw(msg.type, msg.payload);
    }
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
      for (const handler of set) {
        handler(payload, seq);
      }
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

    // Send AUTH message if token is provided
    if (this.options.token) {
      this.sendRaw(Events.AUTH, { token: this.options.token });
    } else {
      // No token — treat as authenticated (public connection)
      this.authenticated = true;
    }
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

    // Auto-handle pong silently
    if (message.type === Events.PONG) return;

    // Handle auth responses
    if (message.type === Events.AUTH_OK) {
      this.authenticated = true;
      this.flushPendingQueue();
      this.emit(message.type, message.payload, message.seq);
      return;
    }

    if (message.type === Events.AUTH_FAIL) {
      this.authenticated = false;
      this.pendingQueue.length = 0;
      this.emit(message.type, message.payload, message.seq);
      return;
    }

    this.emit(message.type, message.payload, message.seq);
  };

  private readonly handleError = (_event: Event): void => {
    // WebSocket onerror is always followed by onclose, so we let handleClose
    // drive state transitions. Nothing extra needed here.
  };
}
