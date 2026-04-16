/**
 * Phase 18.8 PR-4 — Clue + ClueRelation handlers (MSW v2).
 *
 * **Routes (SSOT)**:
 *   `apps/server/internal/domain/editor/clue_handler.go`
 *   `apps/server/internal/domain/editor/clue_relation_handler.go`
 *   - GET    /v1/editor/themes/{themeId}/clues          → ClueResponse[]
 *   - GET    /v1/editor/themes/{themeId}/clue-relations → ClueRelationResponse[]
 *   - PUT    /v1/editor/themes/{themeId}/clue-relations → echo body (saved)
 *   - GET    /v1/clues                (legacy/standalone — empty array)
 *
 * **Shape drift 수정 (PR-2 → PR-4)**:
 *   PR-2 가 `{ relations, mode }` 객체로 잘못 응답했으나, FE 의 `useClueRelations`
 *   는 `useQuery<ClueRelationResponse[]>` — 즉 배열을 직접 기대한다. 본 PR 에서
 *   배열 응답으로 교체한다.
 *
 * **Shape (apps/server/internal/domain/editor/types.go)**:
 *   - ClueResponse: snake_case (id, theme_id, name, clue_type, level, sort_order, ...)
 *   - ClueRelationResponse: camelCase (id, sourceId, targetId, mode)
 *
 * **Default fixture (PR-4 stubbed e2e)**:
 *   3 단서 + 2 엣지 (linear chain c1 → c2 → c3) — React Flow 노드/엣지 렌더 +
 *   클릭 highlight 시나리오 검증용.
 */
import { http, HttpResponse, type DefaultBodyType } from "msw";
import { E2E_THEME_ID } from "./theme";

const url = (path: string) => `*${path}`;

// ---------------------------------------------------------------------------
// Default clue + relation fixture (linear chain — orphan-edge free)
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
  clue_type: "normal",
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

export const E2E_CLUE_RELATION_LIST = Object.freeze([
  {
    id: "00000000-0000-0000-0000-0000000000e1",
    sourceId: E2E_CLUE_IDS.c1,
    targetId: E2E_CLUE_IDS.c2,
    mode: "AND" as const,
  },
  {
    id: "00000000-0000-0000-0000-0000000000e2",
    sourceId: E2E_CLUE_IDS.c2,
    targetId: E2E_CLUE_IDS.c3,
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

  // Editor: clue-relation list (camelCase shape).
  http.get(
    url("/v1/editor/themes/:themeId/clue-relations"),
    ({ params }) => {
      if (params.themeId !== E2E_THEME_ID) {
        return HttpResponse.json([], { status: 200 });
      }
      return HttpResponse.json(E2E_CLUE_RELATION_LIST, { status: 200 });
    },
  ),

  // Editor: clue-relation replace (PUT) — echoes incoming requests with new IDs
  // so the FE optimistic update + queryClient.setQueryData can converge.
  http.put(
    url("/v1/editor/themes/:themeId/clue-relations"),
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
        const rec = r as { sourceId?: string; targetId?: string; mode?: string };
        return {
          id: `saved-${i}-${Date.now()}`,
          sourceId: rec.sourceId ?? "",
          targetId: rec.targetId ?? "",
          mode: rec.mode === "OR" ? "OR" : "AND",
        };
      });
      return HttpResponse.json(saved, { status: 200 });
    },
  ),
];
