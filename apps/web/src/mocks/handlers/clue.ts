/**
 * Phase 20 PR-6 — Clue + ClueEdge handlers (MSW v2).
 *
 * **Routes (SSOT)**:
 *   `apps/server/internal/domain/editor/clue_handler.go`
 *   `apps/server/internal/domain/editor/clue_edge_handler.go`
 *   - GET    /v1/editor/themes/{themeId}/clues       → ClueResponse[] (snake_case)
 *   - GET    /v1/editor/themes/{themeId}/clue-edges  → ClueEdgeGroupResponse[]
 *   - PUT    /v1/editor/themes/{themeId}/clue-edges  → echo body (saved groups)
 *   - GET    /v1/clues                               (legacy — empty array)
 *
 * **Shape (apps/server/internal/domain/editor/types.go)**:
 *   - ClueResponse: snake_case (id, theme_id, name, level, sort_order, ...)
 *   - ClueEdgeGroupResponse: camelCase
 *     { id, targetId, sources[], trigger: "AUTO"|"CRAFT", mode: "AND"|"OR" }
 *
 * **Default fixture**: 3 clues + 2 edge groups (linear chain c1 → c2 → c3,
 * single-source AUTO/AND groups) — matches the pre-PR-6 behavior so existing
 * React Flow rendering and interaction tests keep working.
 */
import { http, HttpResponse, type DefaultBodyType } from "msw";
import { E2E_THEME_ID } from "./theme";

const url = (path: string) => `*${path}`;

// ---------------------------------------------------------------------------
// Default clue + edge group fixture (linear chain — orphan-edge free)
// ---------------------------------------------------------------------------

export const E2E_CLUE_IDS = Object.freeze({
  c1: "00000000-0000-0000-0000-0000000000c1",
  c2: "00000000-0000-0000-0000-0000000000c2",
  c3: "00000000-0000-0000-0000-0000000000c3",
});

const baseClue = {
  theme_id: E2E_THEME_ID,
  location_id: null as string | null,
  description: null as string | null,
  image_url: null as string | null,
  is_common: false,
  level: 1,
  created_at: "2026-04-16T00:00:00Z",
  is_usable: false,
  use_effect: null as string | null,
  use_target: null as string | null,
  use_consumed: false,
};

export const E2E_CLUE_LIST = Object.freeze([
  { ...baseClue, id: E2E_CLUE_IDS.c1, name: "단서 A", sort_order: 1 },
  { ...baseClue, id: E2E_CLUE_IDS.c2, name: "단서 B", sort_order: 2 },
  { ...baseClue, id: E2E_CLUE_IDS.c3, name: "단서 C", sort_order: 3 },
]);

export const E2E_CLUE_EDGE_GROUPS = Object.freeze([
  {
    id: "00000000-0000-0000-0000-0000000000e1",
    targetId: E2E_CLUE_IDS.c2,
    sources: [E2E_CLUE_IDS.c1],
    trigger: "AUTO" as const,
    mode: "AND" as const,
  },
  {
    id: "00000000-0000-0000-0000-0000000000e2",
    targetId: E2E_CLUE_IDS.c3,
    sources: [E2E_CLUE_IDS.c2],
    trigger: "AUTO" as const,
    mode: "AND" as const,
  },
]);

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const clueHandlers = [
  // Legacy/standalone — empty array (kept for any consumer beyond editor scope).
  http.get(url("/v1/clues"), () => HttpResponse.json([], { status: 200 })),

  // Editor: clue list (snake_case shape per server types.go).
  http.get(url("/v1/editor/themes/:themeId/clues"), ({ params }) => {
    if (params.themeId !== E2E_THEME_ID) {
      return HttpResponse.json([], { status: 200 });
    }
    return HttpResponse.json(E2E_CLUE_LIST, { status: 200 });
  }),

  // Editor: clue-edges list (ClueEdgeGroupResponse[], camelCase).
  http.get(
    url("/v1/editor/themes/:themeId/clue-edges"),
    ({ params }) => {
      if (params.themeId !== E2E_THEME_ID) {
        return HttpResponse.json([], { status: 200 });
      }
      return HttpResponse.json(E2E_CLUE_EDGE_GROUPS, { status: 200 });
    },
  ),

  // Editor: clue-edges replace (PUT) — echoes incoming requests with fresh
  // IDs so FE optimistic update + queryClient.setQueryData can converge.
  http.put(
    url("/v1/editor/themes/:themeId/clue-edges"),
    async ({ request, params }) => {
      if (params.themeId !== E2E_THEME_ID) {
        return HttpResponse.json([], { status: 200 });
      }
      const body = (await request.json().catch(() => null)) as
        | DefaultBodyType
        | null;
      if (!Array.isArray(body)) {
        return HttpResponse.json([], { status: 200 });
      }
      const saved = body.map((r, i) => {
        const rec = r as {
          targetId?: string;
          sources?: string[];
          trigger?: string;
          mode?: string;
        };
        return {
          id: `saved-${i}-${Date.now()}`,
          targetId: rec.targetId ?? "",
          sources: Array.isArray(rec.sources) ? rec.sources : [],
          trigger: rec.trigger === "CRAFT" ? "CRAFT" : "AUTO",
          mode: rec.mode === "OR" ? "OR" : "AND",
        };
      });
      return HttpResponse.json(saved, { status: 200 });
    },
  ),
];
