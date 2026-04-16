/**
 * Phase 18.8 PR-2 — Room handlers shape validation.
 *
 * 핵심: theme_id 만으로 POST /v1/rooms → 201 + max_players=theme.max_players
 * (PR-1 의 fallback 거동을 시뮬레이션).
 *
 * Fix-loop 1: players[*] shape 을 서버 PlayerInfo (user_id + is_ready 두 필드)
 * 에 정확히 일치시키는 drift 회귀 방지 테스트 포함.
 */
import { describe, expect, it } from "vitest";
import type { HttpHandler } from "msw";
import { E2E_ROOM_ID, roomHandlers } from "./room";
import { E2E_THEME_ID, E2E_THEME_SUMMARY } from "./theme";
import { E2E_USER } from "./auth";

function findHandler(method: string, suffix: string): HttpHandler {
  for (const h of roomHandlers) {
    const info = (h as HttpHandler).info as { method: string; path: string };
    if (
      info.method.toUpperCase() === method.toUpperCase() &&
      String(info.path).endsWith(suffix)
    ) {
      return h as HttpHandler;
    }
  }
  throw new Error(`handler not found: ${method} ${suffix}`);
}

describe("roomHandlers", () => {
  it("POST /v1/rooms with theme_id only returns 201 + max_players fallback", async () => {
    const handler = findHandler("POST", "/v1/rooms");
    const result = await handler.run({
      request: new Request("http://localhost/v1/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ theme_id: E2E_THEME_ID }),
      }),
    });
    expect(result?.response?.status).toBe(201);
    const body = await result!.response!.json();
    expect(body.id).toBe(E2E_ROOM_ID);
    expect(body.theme_id).toBe(E2E_THEME_ID);
    expect(body.max_players).toBe(E2E_THEME_SUMMARY.max_players);
    expect(body.players).toHaveLength(1);
    // 서버 PlayerInfo 는 user_id + is_ready 두 필드만 가진다 (service.go:46-49).
    // 이전의 is_host/nickname/avatar_url drift 가 회귀하지 않도록 정확한 키
    // 집합을 검증한다.
    expect(body.players[0]).toEqual({
      user_id: E2E_USER.id,
      is_ready: false,
    });
    expect(Object.keys(body.players[0]).sort()).toEqual(["is_ready", "user_id"]);
    expect(body.theme).toMatchObject({ id: E2E_THEME_ID });
    // FE ThemeSummary 가 요구하는 coin_price 가 nested theme 에도 노출되어야 함.
    expect(body.theme.coin_price).toBe(0);
  });

  it("POST /v1/rooms without theme_id returns 400", async () => {
    const handler = findHandler("POST", "/v1/rooms");
    const result = await handler.run({
      request: new Request("http://localhost/v1/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    });
    expect(result?.response?.status).toBe(400);
  });

  it("POST /v1/rooms honors explicit max_players", async () => {
    const handler = findHandler("POST", "/v1/rooms");
    const result = await handler.run({
      request: new Request("http://localhost/v1/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ theme_id: E2E_THEME_ID, max_players: 6, is_private: true }),
      }),
    });
    const body = await result!.response!.json();
    expect(body.max_players).toBe(6);
    expect(body.is_private).toBe(true);
  });

  it("GET /v1/rooms/:id 200 for known id, 404 otherwise", async () => {
    const handler = findHandler("GET", "/v1/rooms/:id");
    const ok = await handler.run({
      request: new Request(`http://localhost/v1/rooms/${E2E_ROOM_ID}`),
    });
    expect(ok?.response?.status).toBe(200);
    const notFound = await handler.run({
      request: new Request("http://localhost/v1/rooms/00000000-0000-0000-0000-000000000999"),
    });
    expect(notFound?.response?.status).toBe(404);
  });
});
