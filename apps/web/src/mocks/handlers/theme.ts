/**
 * Phase 18.8 PR-2 — Theme handlers (MSW v2).
 *
 * Seed 4인 테마 1건을 반환한다. 응답 shape은
 * `apps/server/internal/domain/theme/service.go`의 ThemeSummary / ThemeResponse
 * 와 일치 (snake_case, min_players/max_players/duration_min/price).
 *
 * 기본 데이터는 `apps/server/db/seed/e2e-themes.sql:19-25` 와 동일.
 */
import { http, HttpResponse } from "msw";

export const E2E_THEME_ID = "00000000-0000-0000-0000-0000000001e2";
export const E2E_CREATOR_ID = "00000000-0000-0000-0000-0000000000e2";

export const E2E_THEME_SUMMARY = Object.freeze({
  id: E2E_THEME_ID,
  title: "E2E Test Theme",
  slug: "e2e-test-theme",
  description: "Minimal fixture for Playwright E2E — do not edit",
  cover_image: null as string | null,
  min_players: 4,
  max_players: 8,
  duration_min: 60,
  price: 0,
  creator_id: E2E_CREATOR_ID,
});

export const E2E_THEME_RESPONSE = Object.freeze({
  ...E2E_THEME_SUMMARY,
  status: "PUBLISHED",
  config_json: { characters: [], locations: [], modules: {} },
  version: 1,
  published_at: "2026-04-16T00:00:00Z",
  created_at: "2026-04-16T00:00:00Z",
});

const url = (path: string) => `*${path}`;

export const themeHandlers = [
  http.get(url("/v1/themes"), () =>
    HttpResponse.json([E2E_THEME_SUMMARY], { status: 200 }),
  ),

  http.get(url("/v1/themes/:id"), ({ params }) => {
    if (params.id !== E2E_THEME_ID) {
      return HttpResponse.json(
        {
          type: "about:blank",
          title: "Not Found",
          status: 404,
          detail: "theme not found",
        },
        { status: 404, headers: { "content-type": "application/problem+json" } },
      );
    }
    return HttpResponse.json(E2E_THEME_RESPONSE, { status: 200 });
  }),
];
