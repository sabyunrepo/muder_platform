/**
 * Phase 18.8 PR-2 — Room handlers (MSW v2).
 *
 * Phase 18.8 PR-1 — `max_players` optional + theme.MaxPlayers fallback 기준.
 * 클라이언트가 `theme_id`만 보내도 201을 반환하고, 서버가 fallback 한 값을
 * 시뮬레이션해서 응답한다 (RoomDetailResponse shape).
 *
 * shape 출처: `apps/server/internal/domain/room/service.go` RoomResponse / RoomDetailResponse
 * + `apps/web/src/features/lobby/api.ts` 클라이언트 RoomDetailResponse.
 *
 * NOTE — `players[*]` shape drift (PR-2 fix-loop 1):
 *   서버 `PlayerInfo` Go struct (`apps/server/internal/domain/room/service.go:46-49`)
 *   는 `user_id` + `is_ready` 두 필드만 직렬화한다. mock 은 이 라이브 응답에
 *   정확히 맞춘다 — FE `RoomPlayer` 인터페이스가 더 많은 필드를 가지는 것은
 *   별도 drift 이며 PR scope 밖. Mock 이 거짓 응답을 만들어 unit pass / e2e
 *   fail 을 유발하는 것이 더 위험하므로 서버 진실을 SSOT 로 채택.
 */
import { http, HttpResponse } from "msw";
import { E2E_THEME_ID, E2E_THEME_SUMMARY } from "./theme";
import { E2E_USER } from "./auth";

export const E2E_ROOM_ID = "00000000-0000-0000-0000-0000000002e2";

interface CreateRoomBody {
  theme_id?: string;
  max_players?: number;
  is_private?: boolean;
}

function buildRoom(opts: { isPrivate?: boolean; maxPlayers?: number }) {
  return {
    id: E2E_ROOM_ID,
    code: "MSW-001",
    theme_id: E2E_THEME_ID,
    theme_title: E2E_THEME_SUMMARY.title,
    host_id: E2E_USER.id,
    host_nickname: E2E_USER.nickname,
    status: "WAITING",
    player_count: 1,
    max_players: opts.maxPlayers ?? E2E_THEME_SUMMARY.max_players,
    is_private: opts.isPrivate ?? false,
    created_at: "2026-04-16T00:00:00Z",
    // 서버 PlayerInfo (user_id, is_ready) 두 필드만 직렬화. drift 정정.
    players: [
      {
        user_id: E2E_USER.id,
        is_ready: false,
      },
    ],
    theme: { ...E2E_THEME_SUMMARY },
  };
}

const url = (path: string) => `*${path}`;

export const roomHandlers = [
  http.post(url("/v1/rooms"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as CreateRoomBody;
    if (!body.theme_id) {
      return HttpResponse.json(
        {
          type: "about:blank",
          title: "Bad Request",
          status: 400,
          detail: "theme_id required",
        },
        { status: 400, headers: { "content-type": "application/problem+json" } },
      );
    }
    // PR-1: max_players omitted → server falls back to theme.max_players.
    return HttpResponse.json(
      buildRoom({ isPrivate: body.is_private, maxPlayers: body.max_players }),
      { status: 201 },
    );
  }),

  http.get(url("/v1/rooms"), () =>
    HttpResponse.json([buildRoom({})], { status: 200 }),
  ),

  http.get(url("/v1/rooms/:id"), ({ params }) => {
    if (params.id !== E2E_ROOM_ID) {
      return HttpResponse.json(
        {
          type: "about:blank",
          title: "Not Found",
          status: 404,
          detail: "room not found",
        },
        { status: 404, headers: { "content-type": "application/problem+json" } },
      );
    }
    return HttpResponse.json(buildRoom({}), { status: 200 });
  }),
];
