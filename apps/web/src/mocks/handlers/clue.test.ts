/**
 * Phase 18.8 PR-2 — Clue handlers shape validation.
 */
import { describe, expect, it } from "vitest";
import type { HttpHandler } from "msw";
import { clueHandlers } from "./clue";

function findHandler(method: string, suffix: string): HttpHandler {
  for (const h of clueHandlers) {
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

describe("clueHandlers", () => {
  it("GET /v1/clues returns empty array by default", async () => {
    const handler = findHandler("GET", "/v1/clues");
    const result = await handler.run({
      request: new Request("http://localhost/v1/clues"),
    });
    expect(result?.response?.status).toBe(200);
    const body = await result!.response!.json();
    expect(body).toEqual([]);
  });

  it("GET /v1/clue-relations returns empty relations + AND mode", async () => {
    const handler = findHandler("GET", "/v1/clue-relations");
    const result = await handler.run({
      request: new Request("http://localhost/v1/clue-relations"),
    });
    const body = await result!.response!.json();
    expect(body).toEqual({ relations: [], mode: "AND" });
  });
});
