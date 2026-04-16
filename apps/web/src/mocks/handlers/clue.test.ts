/**
 * Phase 18.8 PR-4 — Clue + ClueRelation handlers shape validation.
 */
import { describe, expect, it } from "vitest";
import type { HttpHandler } from "msw";
import {
  clueHandlers,
  E2E_CLUE_IDS,
  E2E_CLUE_LIST,
  E2E_CLUE_RELATION_LIST,
} from "./clue";
import { E2E_THEME_ID } from "./theme";

function findHandler(method: string, pathContains: string): HttpHandler {
  for (const h of clueHandlers) {
    const info = (h as HttpHandler).info as { method: string; path: string };
    if (
      info.method.toUpperCase() === method.toUpperCase() &&
      String(info.path).includes(pathContains)
    ) {
      return h as HttpHandler;
    }
  }
  throw new Error(`handler not found: ${method} ${pathContains}`);
}

describe("clueHandlers", () => {
  it("GET /v1/clues returns empty array (legacy/standalone)", async () => {
    // path-suffix `*\/v1/clues` (no `editor/themes/` prefix).
    const handler = findHandler("GET", "*/v1/clues");
    const result = await handler.run({
      request: new Request("http://localhost/v1/clues"),
    });
    expect(result?.response?.status).toBe(200);
    const body = await result!.response!.json();
    expect(body).toEqual([]);
  });

  it("GET editor clues returns 3-clue fixture (snake_case)", async () => {
    const handler = findHandler("GET", "/themes/:themeId/clues");
    const result = await handler.run({
      request: new Request(
        `http://localhost/v1/editor/themes/${E2E_THEME_ID}/clues`,
      ),
    });
    expect(result?.response?.status).toBe(200);
    const body = (await result!.response!.json()) as { id: string; name: string; theme_id: string; clue_type: string }[];
    expect(body).toHaveLength(3);
    expect(body[0].id).toBe(E2E_CLUE_IDS.c1);
    expect(body[0].theme_id).toBe(E2E_THEME_ID);
    expect(body[0].clue_type).toBe("normal");
    expect(body).toEqual(E2E_CLUE_LIST);
  });

  it("GET editor clues returns empty for unknown theme", async () => {
    const handler = findHandler("GET", "/themes/:themeId/clues");
    const result = await handler.run({
      request: new Request(
        "http://localhost/v1/editor/themes/other/clues",
      ),
    });
    const body = await result!.response!.json();
    expect(body).toEqual([]);
  });

  it("GET editor clue-relations returns 2-edge fixture (camelCase array)", async () => {
    const handler = findHandler("GET", "/clue-relations");
    const result = await handler.run({
      request: new Request(
        `http://localhost/v1/editor/themes/${E2E_THEME_ID}/clue-relations`,
      ),
    });
    expect(result?.response?.status).toBe(200);
    const body = (await result!.response!.json()) as {
      id: string;
      sourceId: string;
      targetId: string;
      mode: string;
    }[];
    expect(body).toHaveLength(2);
    expect(body[0].sourceId).toBe(E2E_CLUE_IDS.c1);
    expect(body[0].targetId).toBe(E2E_CLUE_IDS.c2);
    expect(body[0].mode).toBe("AND");
    expect(body).toEqual(E2E_CLUE_RELATION_LIST);
  });

  it("PUT editor clue-relations echoes requests as saved records", async () => {
    const handler = findHandler("PUT", "/clue-relations");
    const payload = [
      { sourceId: E2E_CLUE_IDS.c1, targetId: E2E_CLUE_IDS.c3, mode: "AND" },
    ];
    const result = await handler.run({
      request: new Request(
        `http://localhost/v1/editor/themes/${E2E_THEME_ID}/clue-relations`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      ),
    });
    expect(result?.response?.status).toBe(200);
    const body = (await result!.response!.json()) as {
      id: string;
      sourceId: string;
      targetId: string;
      mode: string;
    }[];
    expect(body).toHaveLength(1);
    expect(body[0].sourceId).toBe(E2E_CLUE_IDS.c1);
    expect(body[0].targetId).toBe(E2E_CLUE_IDS.c3);
    expect(body[0].mode).toBe("AND");
    expect(body[0].id).toMatch(/^saved-/);
  });
});
