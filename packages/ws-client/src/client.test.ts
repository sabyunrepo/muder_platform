import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WsEventType } from '@mmp/shared';
import type { ErrorPayload } from '@mmp/shared';
import { WsClient } from './client.js';
import { WsClientState } from './types.js';
import { FakeWebSocket, installFakeWebSocket } from './__tests__/fake-websocket.js';
import type { FakeWsHandle } from './__tests__/fake-websocket.js';

// All tests use fake timers because WsClient runs a 30s heartbeat
// setInterval and the reconnect schedule is a setTimeout. Disabling real
// time keeps the test deterministic.
let handle: FakeWsHandle;

beforeEach(() => {
  vi.useFakeTimers();
  handle = installFakeWebSocket();
});

afterEach(() => {
  vi.useRealTimers();
  handle.restore();
});

function newClient(
  opts: {
    authProtocol?: boolean;
    token?: string;
    onRevoked?: (code: string, reason: string) => void;
    onUnauthorized?: (reason: string) => void;
    onTokenRefreshed?: (token: string, expiresAt: number) => void;
    onServerError?: (payload: ErrorPayload) => void;
    reconnect?: { enabled?: boolean; baseDelay?: number; maxAttempts?: number };
  } = {}
): WsClient {
  return new WsClient({
    url: 'ws://test',
    token: opts.token ?? 'tok',
    authProtocol: opts.authProtocol,
    onRevoked: opts.onRevoked,
    onUnauthorized: opts.onUnauthorized,
    onTokenRefreshed: opts.onTokenRefreshed,
    onServerError: opts.onServerError,
    heartbeatInterval: 999_999, // park heartbeat way out of test timelines
    reconnect: { baseDelay: 10, maxAttempts: 5, ...opts.reconnect },
  });
}

// ---------------------------------------------------------------------------
// Flag gate
// ---------------------------------------------------------------------------

describe('WsClient — authProtocol flag gate', () => {
  it('flag off: no auth.identify is sent on open', () => {
    const c = newClient({ authProtocol: false });
    c.connect();
    handle.getLast().triggerOpen();
    expect(handle.getLast().sent).toHaveLength(0);
    c.disconnect();
  });

  it('flag on: first connect sends auth.identify with the configured token', () => {
    const c = newClient({ authProtocol: true, token: 'tok-A' });
    c.connect();
    handle.getLast().triggerOpen();
    expect(handle.getLast().sent).toHaveLength(1);
    expect(handle.getLast().sent[0]).toMatchObject({
      type: WsEventType.AUTH_IDENTIFY,
      payload: { token: 'tok-A' },
    });
    c.disconnect();
  });
});

// ---------------------------------------------------------------------------
// Resume bookkeeping
// ---------------------------------------------------------------------------

describe('WsClient — resume bookkeeping', () => {
  it('captures sessionId from the connected envelope and re-uses it on resume', () => {
    const c = newClient({ authProtocol: true });
    c.connect();
    const ws1 = handle.getLast();
    ws1.triggerOpen();
    // First sent frame is auth.identify; clear it so the next assertions
    // are cleaner.
    expect(ws1.sent.at(0)?.type).toBe(WsEventType.AUTH_IDENTIFY);
    ws1.sent.length = 0;

    // Server delivers connected{sessionId, seq=1} then a few more frames
    // so lastSeq advances past the initial 1.
    ws1.triggerMessage({
      type: WsEventType.CONNECTED,
      payload: { playerId: 'p', sessionId: 'sess-1', seq: 1 },
      ts: 0,
      seq: 1,
    });
    ws1.triggerMessage({
      type: 'game:state' as never,
      payload: { foo: 'bar' },
      ts: 0,
      seq: 2,
    });

    // Server-initiated close → reconnect schedule fires → new socket opens.
    ws1.triggerServerClose();
    vi.runAllTimers();
    const ws2 = handle.getLast();
    expect(ws2).not.toBe(ws1);
    ws2.triggerOpen();

    expect(ws2.sent).toHaveLength(1);
    expect(ws2.sent[0]).toMatchObject({
      type: WsEventType.AUTH_RESUME,
      payload: { token: 'tok', sessionId: 'sess-1', lastSeq: 2 },
    });
    c.disconnect();
  });
});

// ---------------------------------------------------------------------------
// auth.token_issued
// ---------------------------------------------------------------------------

describe('WsClient — auth.token_issued', () => {
  it('swaps the in-memory token and fires onTokenRefreshed', () => {
    const onTokenRefreshed = vi.fn();
    const c = newClient({ authProtocol: true, token: 'old', onTokenRefreshed });
    c.connect();
    const ws1 = handle.getLast();
    ws1.triggerOpen();
    ws1.sent.length = 0;

    ws1.triggerMessage({
      type: WsEventType.AUTH_TOKEN_ISSUED,
      payload: { token: 'new-token', expiresAt: 1234567 },
      ts: 0,
      seq: 1,
    });

    expect(onTokenRefreshed).toHaveBeenCalledTimes(1);
    expect(onTokenRefreshed).toHaveBeenCalledWith('new-token', 1234567);
    // The next reconnect URL must use the rotated token. Force a reconnect.
    ws1.triggerServerClose();
    vi.runAllTimers();
    const ws2 = handle.getLast();
    expect(ws2.url).toContain('token=new-token');
    c.disconnect();
  });

  it('does not bubble auth.token_issued to ordinary listeners', () => {
    const c = newClient({ authProtocol: true });
    const handler = vi.fn();
    c.on(WsEventType.AUTH_TOKEN_ISSUED, handler);
    c.connect();
    handle.getLast().triggerOpen();
    handle.getLast().triggerMessage({
      type: WsEventType.AUTH_TOKEN_ISSUED,
      payload: { token: 'x', expiresAt: 0 },
      ts: 0,
      seq: 1,
    });
    expect(handler).not.toHaveBeenCalled();
    c.disconnect();
  });
});

// ---------------------------------------------------------------------------
// auth.revoked
// ---------------------------------------------------------------------------

describe('WsClient — auth.revoked', () => {
  it('fires onRevoked and disables further reconnect attempts', () => {
    const onRevoked = vi.fn();
    const c = newClient({ authProtocol: true, onRevoked });
    c.connect();
    const ws1 = handle.getLast();
    ws1.triggerOpen();
    ws1.sent.length = 0;

    ws1.triggerMessage({
      type: WsEventType.AUTH_REVOKED,
      payload: { code: 'banned', reason: 'admin ban' },
      ts: 0,
      seq: 1,
    });
    expect(onRevoked).toHaveBeenCalledWith('banned', 'admin ban');

    // Server closes the socket; the client must NOT reconnect.
    ws1.triggerServerClose();
    vi.runAllTimers();
    expect(handle.getAll()).toHaveLength(1);
    expect(c.connectionState).toBe(WsClientState.DISCONNECTED);
  });
});

// ---------------------------------------------------------------------------
// auth.invalid_session
// ---------------------------------------------------------------------------

describe('WsClient — auth.invalid_session', () => {
  it('resumable=true: drops sessionId so the next reconnect identifies, not resumes', () => {
    const c = newClient({ authProtocol: true });
    c.connect();
    const ws1 = handle.getLast();
    ws1.triggerOpen();
    ws1.sent.length = 0;

    // Establish sessionId first.
    ws1.triggerMessage({
      type: WsEventType.CONNECTED,
      payload: { playerId: 'p', sessionId: 'sess-1', seq: 1 },
      ts: 0,
      seq: 1,
    });
    // Server says "your resume target is gone, but you're still valid".
    ws1.triggerMessage({
      type: WsEventType.AUTH_INVALID_SESSION,
      payload: { resumable: true, reason: 'buffer expired' },
      ts: 0,
      seq: 2,
    });
    // Server-initiated close triggers reconnect.
    ws1.triggerServerClose();
    vi.runAllTimers();
    const ws2 = handle.getLast();
    expect(ws2).not.toBe(ws1);
    ws2.triggerOpen();

    // Must fall back to identify (sessionId was cleared) instead of resume.
    expect(ws2.sent.at(0)?.type).toBe(WsEventType.AUTH_IDENTIFY);
    c.disconnect();
  });

  it('resumable=false: fires onUnauthorized and disables reconnect', () => {
    const onUnauthorized = vi.fn();
    const c = newClient({ authProtocol: true, onUnauthorized });
    c.connect();
    const ws1 = handle.getLast();
    ws1.triggerOpen();
    ws1.sent.length = 0;

    ws1.triggerMessage({
      type: WsEventType.AUTH_INVALID_SESSION,
      payload: { resumable: false, reason: 'user fully unauthorized' },
      ts: 0,
      seq: 1,
    });
    expect(onUnauthorized).toHaveBeenCalledWith('user fully unauthorized');

    ws1.triggerServerClose();
    vi.runAllTimers();
    expect(handle.getAll()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// refreshToken()
// ---------------------------------------------------------------------------

describe('WsClient — refreshToken()', () => {
  it('sends auth.refresh with the supplied refresh token', () => {
    const c = newClient({ authProtocol: true });
    c.connect();
    const ws1 = handle.getLast();
    ws1.triggerOpen();
    ws1.sent.length = 0;

    c.refreshToken('refresh-tok-xyz');

    expect(ws1.sent).toHaveLength(1);
    expect(ws1.sent[0]).toMatchObject({
      type: WsEventType.AUTH_REFRESH,
      payload: { token: 'refresh-tok-xyz' },
    });
    c.disconnect();
  });

  it('throws when authProtocol is false', () => {
    const c = newClient({ authProtocol: false });
    c.connect();
    handle.getLast().triggerOpen();
    expect(() => c.refreshToken('x')).toThrow(/authProtocol: true/);
    c.disconnect();
  });
});

// ---------------------------------------------------------------------------
// Sanity: a non-PR-9 incoming envelope still reaches its listener
// ---------------------------------------------------------------------------

describe('WsClient — regression: ordinary events still emit', () => {
  it('a non-auth envelope is delivered to subscribed listeners', () => {
    const c = newClient({ authProtocol: true });
    const handler = vi.fn();
    c.on('game:state' as never, handler);
    c.connect();
    handle.getLast().triggerOpen();
    handle.getLast().triggerMessage({
      type: 'game:state',
      payload: { foo: 'bar' },
      ts: 0,
      seq: 1,
    });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ foo: 'bar' }, 1);
    c.disconnect();
  });
});

// ---------------------------------------------------------------------------
// Generic server error frames
// ---------------------------------------------------------------------------

describe('WsClient — server error frames', () => {
  it('routes recoverable error frames to onServerError without ordinary emit', () => {
    const onServerError = vi.fn();
    const handler = vi.fn();
    const c = newClient({ authProtocol: true, onServerError });
    c.on(WsEventType.ERROR, handler);
    c.connect();
    const ws1 = handle.getLast();
    ws1.triggerOpen();

    const payload = {
      code: 4003,
      app_code: 'SESSION_INBOX_FULL',
      message: '요청이 많아 잠시 후 다시 시도해주세요.',
      severity: 'medium',
      retryable: true,
      fatal: false,
    };
    ws1.triggerMessage({
      type: WsEventType.ERROR,
      payload,
      ts: 0,
      seq: 1,
    });

    expect(onServerError).toHaveBeenCalledWith(payload);
    expect(handler).not.toHaveBeenCalled();
    c.disconnect();
  });

  it('fatal error frames disable reconnect', () => {
    const onServerError = vi.fn();
    const c = newClient({ authProtocol: true, onServerError });
    c.connect();
    const ws1 = handle.getLast();
    ws1.triggerOpen();

    ws1.triggerMessage({
      type: WsEventType.ERROR,
      payload: {
        code: 4001,
        app_code: 'UNAUTHORIZED',
        message: '인증이 필요합니다.',
        severity: 'high',
        retryable: false,
        fatal: true,
      },
      ts: 0,
      seq: 1,
    });
    ws1.triggerServerClose();
    vi.runAllTimers();

    expect(onServerError).toHaveBeenCalledTimes(1);
    expect(handle.getAll()).toHaveLength(1);
    expect(c.connectionState).toBe(WsClientState.DISCONNECTED);
  });
});

// Suppress unused-import warning when FakeWebSocket itself is not directly
// referenced (we use installFakeWebSocket).
void FakeWebSocket;
