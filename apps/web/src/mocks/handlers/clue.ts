/**
 * Phase 18.8 PR-2 — Clue handlers (MSW v2).
 *
 * 기본은 빈 배열. 개별 spec이 `server.use(...)`로 override 한다.
 *
 * shape 출처: `apps/server/internal/domain/editor/types.go`
 *  - ClueResponse (snake_case, theme_id/clue_type/sort_order/...)
 *  - ClueRelationResponse (camelCase, sourceId/targetId/mode)
 */
import { http, HttpResponse } from "msw";

const url = (path: string) => `*${path}`;

export const clueHandlers = [
  http.get(url("/v1/clues"), () => HttpResponse.json([], { status: 200 })),

  http.get(url("/v1/clue-relations"), () =>
    HttpResponse.json({ relations: [], mode: "AND" }, { status: 200 }),
  ),
];
