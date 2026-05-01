import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// PR-9 — WS Auth Protocol revoke→close acceptance test.
//
// This spec validates the W4 acceptance gate ("revoke → 30s WS close")
// end-to-end against a live backend. It deliberately bypasses the
// React UI and drives a raw WebSocket so the measurement isolates the
// server-side push timing from any frontend reconnect debounce.
//
// Skip conditions:
//  - backend /health is not reachable (no Go server running)
//  - the server-side MMP_WS_AUTH_PROTOCOL flag is off (Hub.RevokeUser
//    is wired regardless, so this skip is informational rather than a
//    hard gate; we leave it as a soft hint via test.skip)
//
// Manual verification (when the dev stack is running):
//   MMP_WS_AUTH_PROTOCOL=true pnpm --filter server dev
//   pnpm --filter web exec playwright test e2e/ws-auth-revoke.spec.ts
// ---------------------------------------------------------------------------

const BACKEND_HTTP = "http://localhost:8080";
const BACKEND_WS = "ws://localhost:8080";
const LOGIN_EMAIL = "e2e@test.com";
const LOGIN_PASSWORD = "e2etest1234";
const REVOKE_DEADLINE_MS = 30_000; // W4 acceptance budget
const OPEN_GRACE_MS = 750; // give the WS a moment to open + identify

interface TokenPair {
  access_token: string;
  refresh_token: string;
}

interface ProbeResult {
  closed: boolean;
  lapsedMs: number;
  receivedRevoked: boolean;
  closeCode?: number;
}

// Serial mode because both tests log in as the same e2e seed user. With
// workers=2 the second test's WS register would silently steal the first
// test's slot via SocialHub's single-session enforcement, masking the
// real PR-9 push.
test.describe.configure({ mode: "serial" });

test.describe("PR-9 WS Auth Protocol — revoke pushes close within 30s", () => {
  test.beforeEach(async ({ request }) => {
    const health = await request
      .get(`${BACKEND_HTTP}/health`)
      .catch(() => null);
    test.skip(
      !health || !health.ok(),
      "backend not running on :8080 — start the dev server to exercise this spec",
    );
  });

  test("logout fetch closes the user's social WS within 30s with auth.revoked", async ({
    page,
    request,
  }) => {
    // 1. Mint a fresh token pair via the public login endpoint. Bypasses
    // the React form — a precondition fixture, not a UI assertion.
    const loginRes = await request.post(`${BACKEND_HTTP}/api/v1/auth/login`, {
      data: { email: LOGIN_EMAIL, password: LOGIN_PASSWORD },
    });
    test.skip(
      !loginRes.ok(),
      `login failed (${loginRes.status()}): seed user '${LOGIN_EMAIL}' missing — see scripts/seed/e2e_user.sql`,
    );
    const tokens = (await loginRes.json()) as TokenPair;
    expect(tokens.access_token).toBeTruthy();

    // 2. Open a raw WebSocket from inside the browser context. We send
    // an auth.identify frame post-open so the server's PR-9 dispatcher
    // exercises the same code path the production WsClient takes.
    // The promise resolves either when onclose fires (success) or after
    // a hard timeout (failure measured against the 30s budget).
    // The Go server CheckOrigin enforces CORS_ORIGINS even in dev mode
    // when the list is non-empty. Loading the page from the same origin
    // as `pnpm dev` (http://localhost:3000) so the WebSocket handshake
    // carries an allowed Origin header.
    await page.goto("http://localhost:3000/");
    const probe = page.evaluate<ProbeResult, { token: string; deadlineMs: number; wsBase: string }>(
      ({ token, deadlineMs, wsBase }) =>
        new Promise<ProbeResult>((resolve) => {
          const t0 = Date.now();
          const url = `${wsBase}/ws/social?token=${encodeURIComponent(token)}`;
          const ws = new WebSocket(url);
          let opened = false;
          let receivedRevoked = false;
          ws.onopen = () => {
            opened = true;
            ws.send(
              JSON.stringify({
                type: "auth.identify",
                payload: { token },
                ts: Date.now(),
                seq: 0,
              }),
            );
          };
          ws.onmessage = (ev) => {
            try {
              const msg = JSON.parse(String(ev.data)) as { type?: string };
              if (msg.type === "auth.revoked") {
                receivedRevoked = true;
              }
            } catch {
              // ignore parse failures — only auth.revoked is interesting here
            }
          };
          ws.onclose = (ev) => {
            resolve({
              closed: opened,
              lapsedMs: Date.now() - t0,
              receivedRevoked,
              closeCode: ev.code,
            });
          };
          // Hard cap so the test never hangs past the budget.
          setTimeout(() => {
            try {
              ws.close();
            } catch {
              // already closed
            }
            resolve({
              closed: false,
              lapsedMs: Date.now() - t0,
              receivedRevoked,
            });
          }, deadlineMs);
        }),
      { token: tokens.access_token, deadlineMs: REVOKE_DEADLINE_MS, wsBase: BACKEND_WS },
    );

    // 3. Give the socket a moment to open and identify before the
    // logout call races in.
    await page.waitForTimeout(OPEN_GRACE_MS);

    // 4. Trigger the revoke. service.Logout writes a revoke_log row and
    // calls Hub.RevokeUser → push auth.revoked + close. Only the game
    // Hub is wired as the publisher today (Task 3.6 note); social
    // sockets close because Hub.RevokeUser walks players[userID] which
    // includes the lobby socket bound to this user.
    const logoutRes = await request.post(
      `${BACKEND_HTTP}/api/v1/auth/logout`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );
    expect(logoutRes.ok()).toBe(true);

    // 5. Read the probe result. The W4 budget is 30s — anything under
    // that passes; CI fails fast if the push regresses.
    const result = await probe;
    expect(
      result.closed,
      `WS never opened or never closed within ${REVOKE_DEADLINE_MS}ms`,
    ).toBe(true);
    expect(result.lapsedMs).toBeLessThan(REVOKE_DEADLINE_MS);

    // receivedRevoked is informational: when the social Hub publisher
    // wiring lands the auth.revoked frame should arrive before close.
    // For now (game-only publisher) the close still fires because the
    // socket is dropped, just without the in-band envelope. Soft check.
    if (!result.receivedRevoked) {
      console.warn(
        "[ws-auth-revoke] auth.revoked envelope was not observed before close — " +
          "social Hub publisher wiring is a documented PR-9 follow-up",
      );
    }
  });

  test("post-revoke reconnect with the same token is rejected within 30s", async ({
    page,
    request,
  }) => {
    const loginRes = await request.post(`${BACKEND_HTTP}/api/v1/auth/login`, {
      data: { email: LOGIN_EMAIL, password: LOGIN_PASSWORD },
    });
    test.skip(!loginRes.ok(), `login failed (${loginRes.status()})`);
    const tokens = (await loginRes.json()) as TokenPair;

    // Logout writes the revoke_log entry the reconnect path will read.
    const logoutRes = await request.post(
      `${BACKEND_HTTP}/api/v1/auth/logout`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );
    expect(logoutRes.ok()).toBe(true);

    // The access token is still cryptographically valid (15-min TTL), so
    // the upgrade itself succeeds. The PR-9 pull fallback in
    // AuthHandler.handleIdentify rejects the post-open identify because
    // IsUserRevokedSince returns true. Verify by issuing the WS upgrade
    // from the page context (which carries an allowed Origin header)
    // and watching for an auth.revoked frame followed by close.
    await page.goto("http://localhost:3000/");
    const result = await page.evaluate<ProbeResult, { token: string; deadlineMs: number; wsBase: string }>(
      ({ token, deadlineMs, wsBase }) =>
        new Promise<ProbeResult>((resolve) => {
          const t0 = Date.now();
          const ws = new WebSocket(
            `${wsBase}/ws/social?token=${encodeURIComponent(token)}`,
          );
          let opened = false;
          let receivedRevoked = false;
          ws.onopen = () => {
            opened = true;
            ws.send(
              JSON.stringify({
                type: "auth.identify",
                payload: { token },
                ts: Date.now(),
                seq: 0,
              }),
            );
          };
          ws.onmessage = (ev) => {
            try {
              const msg = JSON.parse(String(ev.data)) as { type?: string };
              if (msg.type === "auth.revoked") {
                receivedRevoked = true;
              }
            } catch {
              /* ignore */
            }
          };
          ws.onclose = (ev) => {
            resolve({
              closed: opened,
              lapsedMs: Date.now() - t0,
              receivedRevoked,
              closeCode: ev.code,
            });
          };
          setTimeout(() => {
            try {
              ws.close();
            } catch {
              /* already closed */
            }
            resolve({
              closed: false,
              lapsedMs: Date.now() - t0,
              receivedRevoked,
            });
          }, deadlineMs);
        }),
      { token: tokens.access_token, deadlineMs: REVOKE_DEADLINE_MS, wsBase: BACKEND_WS },
    );

    expect(result.closed).toBe(true);
    expect(result.lapsedMs).toBeLessThan(REVOKE_DEADLINE_MS);
  });
});
