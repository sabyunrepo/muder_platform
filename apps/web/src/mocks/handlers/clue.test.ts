/**
 * Phase 20 PR-6 — Clue + ClueEdge handlers shape validation.
 */
import { describe, expect, it } from "vitest";
import type { HttpHandler } from "msw";
import {
  clueHandlers,
  E2E_CLUE_IDS,
  E2E_CLUE_LIST,
  E2E_CLUE_EDGE_GROUPS,
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
    const body = (await result!.response!.json()) as { id: string; name: string; theme_id: string }[];
    expect(body).toHaveLength(3);
    expect(body[0].id).toBe(E2E_CLUE_IDS.c1);
    expect(body[0].theme_id).toBe(E2E_THEME_ID);
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

  it("GET editor clue-edges returns 2-group fixture (camelCase, trigger+sources[])", async () => {
    const handler = findHandler("GET", "/clue-edges");
    const result = await handler.run({
      request: new Request(
        `http://localhost/v1/editor/themes/${E2E_THEME_ID}/clue-edges`,
      ),
    });
    expect(result?.response?.status).toBe(200);
    const body = (await result!.response!.json()) as {
      id: string;
      targetId: string;
      sources: string[];
      trigger: string;
      mode: string;
    }[];
    expect(body).toHaveLength(2);
    expect(body[0].targetId).toBe(E2E_CLUE_IDS.c2);
    expect(body[0].sources).toEqual([E2E_CLUE_IDS.c1]);
    expect(body[0].trigger).toBe("AUTO");
    expect(body[0].mode).toBe("AND");
    expect(body).toEqual(E2E_CLUE_EDGE_GROUPS);
  });

  it("PUT editor clue-edges echoes requests as saved records", async () => {
    const handler = findHandler("PUT", "/clue-edges");
    const payload = [
      {
        targetId: E2E_CLUE_IDS.c3,
        sources: [E2E_CLUE_IDS.c1],
        trigger: "CRAFT",
        mode: "AND",
      },
    ];
    const result = await handler.run({
      request: new Request(
        `http://localhost/v1/editor/themes/${E2E_THEME_ID}/clue-edges`,
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
      targetId: string;
      sources: string[];
      trigger: string;
      mode: string;
    }[];
    expect(body).toHaveLength(1);
    expect(body[0].targetId).toBe(E2E_CLUE_IDS.c3);
    expect(body[0].sources).toEqual([E2E_CLUE_IDS.c1]);
    expect(body[0].trigger).toBe("CRAFT");
    expect(body[0].mode).toBe("AND");
    expect(body[0].id).toMatch(/^saved-/);
  });

  // Mock fallback for non-array body — server SSOT is 400, but the stub is
  // tolerant so unrelated E2E flows don't crash on malformed PUTs.
  it("PUT clue-edges with non-array body returns 200 + empty array", async () => {
    const handler = findHandler("PUT", "/themes/:themeId/clue-edges");
    const result = await handler.run({
      request: new Request(
        `http://localhost/v1/editor/themes/${E2E_THEME_ID}/clue-edges`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ not: "an array" }),
        },
      ),
    });
    expect(result?.response?.status).toBe(200);
    const body = await result!.response!.json();
    expect(body).toEqual([]);
  });
});
