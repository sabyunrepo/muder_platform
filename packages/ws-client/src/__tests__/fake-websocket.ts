// Hand-rolled WebSocket double for ws-client tests.
//
// WsClient touches a narrow slice of the WebSocket API: constructor with
// a URL, the four `on{open,close,message,error}` setters, `send(data)`,
// and `close(code, reason)`. Everything else is irrelevant, so a real
// mock-socket dep would be overkill — this tiny class covers the surface
// and exposes test-only triggers (`triggerOpen`, `triggerMessage`,
// `triggerServerClose`) that the production WsClient code never calls.

let lastInstance: FakeWebSocket | null = null;
let allInstances: FakeWebSocket[] = [];

export class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = FakeWebSocket.OPEN;
  url: string;
  onopen: (() => void) | null = null;
  onclose: ((e: { code: number; reason: string }) => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  /** Every payload passed to `.send()` is captured here as the parsed JSON. */
  sent: Array<Record<string, unknown>> = [];
  closeCalls: Array<{ code: number; reason: string }> = [];

  constructor(url: string) {
    this.url = url;
    lastInstance = this;
    allInstances.push(this);
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  close(code?: number, reason?: string): void {
    const event = { code: code ?? 1000, reason: reason ?? "" };
    this.closeCalls.push(event);
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    // Mirror browser behaviour: a client-driven close does not synchronously
    // invoke onclose. WsClient.disconnect nulls onclose before calling
    // close() to suppress reconnect, so leaving this silent is correct.
  }

  // ---- Test triggers (production WsClient never calls these) -----------

  triggerOpen(): void {
    this.onopen?.();
  }

  triggerMessage(envelope: object): void {
    this.onmessage?.({ data: JSON.stringify(envelope) });
  }

  /** Simulate a server-initiated close — fires onclose so reconnect can run. */
  triggerServerClose(code = 1000, reason = "server close"): void {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code, reason });
  }
}

export interface FakeWsHandle {
  restore: () => void;
  getLast: () => FakeWebSocket;
  getAll: () => FakeWebSocket[];
}

/**
 * Replace global WebSocket with FakeWebSocket. Returns a restore hook so
 * each test can isolate itself in afterEach.
 */
export function installFakeWebSocket(): FakeWsHandle {
  type GlobalWithWs = typeof globalThis & { WebSocket?: unknown };
  const g = globalThis as GlobalWithWs;
  const original = g.WebSocket;
  g.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
  lastInstance = null;
  allInstances = [];
  return {
    restore: () => {
      if (original === undefined) {
        delete (g as Record<string, unknown>).WebSocket;
      } else {
        g.WebSocket = original;
      }
    },
    getLast: () => {
      if (lastInstance === null) {
        throw new Error("FakeWebSocket: no instance has been constructed yet");
      }
      return lastInstance;
    },
    getAll: () => [...allInstances],
  };
}
