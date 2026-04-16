/**
 * Phase 18.8 PR-2 — Theme handlers shape validation.
 */
import { describe, expect, it } from "vitest";
import type { HttpHandler } from "msw";
import { E2E_THEME_ID, E2E_THEME_SUMMARY, themeHandlers } from "./theme";

function findHandler(method: string, suffix: string): HttpHandler {
  for (const h of themeHandlers) {
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

describe("themeHandlers", () => {
  it("GET /v1/themes returns array with seed theme summary", async () => {
    const handler = findHandler("GET", "/v1/themes");
    const result = await handler.run({
      request: new Request("http://localhost/v1/themes"),
    });
    expect(result?.response?.status).toBe(200);
    const body = await result!.response!.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toMatchObject({
      id: E2E_THEME_SUMMARY.id,
      title: E2E_THEME_SUMMARY.title,
      slug: E2E_THEME_SUMMARY.slug,
      min_players: 4,
      max_players: 8,
      duration_min: 60,
      price: 0,
      // coin_price 는 FE `ThemeSummary` 계약 필수 필드 — drift 회귀 방지.
      coin_price: 0,
    });
    expect(body[0].coin_price).toBeDefined();
  });

  it("GET /v1/themes/:id returns full ThemeResponse", async () => {
    const handler = findHandler("GET", "/v1/themes/:id");
    const result = await handler.run({
      request: new Request(`http://localhost/v1/themes/${E2E_THEME_ID}`),
    });
    const body = await result!.response!.json();
    expect(body).toMatchObject({
      id: E2E_THEME_ID,
      status: "PUBLISHED",
      version: 1,
    });
    expect(body.config_json).toBeDefined();
    expect(body.created_at).toBeDefined();
  });

  it("GET /v1/themes/:id 404 when unknown id", async () => {
    const handler = findHandler("GET", "/v1/themes/:id");
    const result = await handler.run({
      request: new Request("http://localhost/v1/themes/00000000-0000-0000-0000-000000000999"),
    });
    expect(result?.response?.status).toBe(404);
  });
});
