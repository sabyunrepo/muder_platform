/**
 * Phase 18.8 PR-2 — Auth handlers shape validation.
 *
 * MSW handler 의 직접 호출(`.run()`)로 실제 fetch 없이 응답 검증.
 * 서버 struct (auth/service.go) 와 drift 발생 시 즉시 fail.
 */
import { describe, expect, it } from "vitest";
import type { HttpHandler } from "msw";
import { authHandlers, E2E_TOKEN_PAIR, E2E_USER } from "./auth";

async function callHandler(
  handler: HttpHandler,
  request: Request,
): Promise<Response | null> {
  const result = await handler.run({ request });
  return result?.response ?? null;
}

function findHandler(method: string, pathSuffix: string): HttpHandler {
  for (const h of authHandlers) {
    const info = (h as HttpHandler).info as { method: string; path: string };
    if (
      info.method.toUpperCase() === method.toUpperCase() &&
      String(info.path).endsWith(pathSuffix)
    ) {
      return h as HttpHandler;
    }
  }
  throw new Error(`handler not found: ${method} ${pathSuffix}`);
}

describe("authHandlers", () => {
  it("POST /v1/auth/login returns TokenPair shape", async () => {
    const handler = findHandler("POST", "/v1/auth/login");
    const res = await callHandler(
      handler,
      new Request("http://localhost/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "e2e@test.com", password: "e2etest1234" }),
      }),
    );
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body).toMatchObject({
      access_token: E2E_TOKEN_PAIR.access_token,
      refresh_token: E2E_TOKEN_PAIR.refresh_token,
      expires_in: E2E_TOKEN_PAIR.expires_in,
    });
  });

  it("POST /v1/auth/login rejects missing credentials with 400", async () => {
    const handler = findHandler("POST", "/v1/auth/login");
    const res = await callHandler(
      handler,
      new Request("http://localhost/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res).not.toBeNull();
    expect(res!.status).toBe(400);
    expect(res!.headers.get("content-type")).toContain("application/problem+json");
  });

  it("GET /v1/auth/me returns UserResponse shape", async () => {
    const handler = findHandler("GET", "/v1/auth/me");
    const res = await callHandler(
      handler,
      new Request("http://localhost/v1/auth/me"),
    );
    expect(res).not.toBeNull();
    const body = await res!.json();
    expect(body).toMatchObject({
      id: E2E_USER.id,
      nickname: E2E_USER.nickname,
      email: E2E_USER.email,
      role: E2E_USER.role,
    });
  });

  it("POST /v1/auth/refresh returns TokenPair", async () => {
    const handler = findHandler("POST", "/v1/auth/refresh");
    const res = await callHandler(
      handler,
      new Request("http://localhost/v1/auth/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh_token: "stale" }),
      }),
    );
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.access_token).toBe(E2E_TOKEN_PAIR.access_token);
  });
});
