/**
 * Phase 18.8 PR-2 — Auth handlers (MSW v2).
 *
 * 서버 응답 shape는 `apps/server/internal/domain/auth/service.go`의
 * TokenPair / UserResponse와 일치한다 (drift 방지).
 *
 * 기본 자격증명: e2e@test.com / e2etest1234 (E2E seed 사용자).
 */
import { http, HttpResponse } from "msw";

export const E2E_USER = Object.freeze({
  id: "00000000-0000-0000-0000-0000000000e2",
  nickname: "테스터",
  email: "e2e@test.com",
  avatar_url: null as string | null,
  role: "user",
});

export const E2E_TOKEN_PAIR = Object.freeze({
  access_token: "msw-access-token",
  refresh_token: "msw-refresh-token",
  expires_in: 3600,
});

interface LoginBody {
  email?: string;
  password?: string;
}

interface RefreshBody {
  refresh_token?: string;
}

/**
 * MSW v2 handler를 절대 URL과 상대 경로 둘 다 매칭시키기 위해
 * `*` prefix를 붙인다. ApiClient는 `/api` prefix를 자동 추가하므로
 * 두 형태 모두 인터셉트 가능해야 한다.
 */
const url = (path: string) => `*${path}`;

export const authHandlers = [
  http.post(url("/v1/auth/login"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as LoginBody;
    if (!body.email || !body.password) {
      return HttpResponse.json(
        {
          type: "about:blank",
          title: "Bad Request",
          status: 400,
          detail: "email and password required",
        },
        { status: 400, headers: { "content-type": "application/problem+json" } },
      );
    }
    return HttpResponse.json(E2E_TOKEN_PAIR, { status: 200 });
  }),

  http.post(url("/v1/auth/refresh"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as RefreshBody;
    if (!body.refresh_token) {
      return HttpResponse.json(
        {
          type: "about:blank",
          title: "Bad Request",
          status: 400,
          detail: "refresh_token required",
        },
        { status: 400, headers: { "content-type": "application/problem+json" } },
      );
    }
    return HttpResponse.json(E2E_TOKEN_PAIR, { status: 200 });
  }),

  http.get(url("/v1/auth/me"), () => HttpResponse.json(E2E_USER, { status: 200 })),
];
