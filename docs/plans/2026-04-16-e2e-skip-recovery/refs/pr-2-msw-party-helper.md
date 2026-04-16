# PR-2 — test(e2e): MSW foundation + party helper

> 부모: [../plan.md](../plan.md)
> Wave: 1 (parallel) | 의존: - | 브랜치: `test/e2e-msw-helpers`

---

## 목적

(1) HTTP 계약 SSOT를 MSW v2로 확립 — Vitest·Playwright·(장래)Storybook이 동일 handler 공유. (2) 7개 spec에 중복된 `login()`과 없었던 `createPartyOfN` 공용 헬퍼 제공.

---

## Scope

```yaml
scope_globs:
  - apps/web/src/mocks/**
  - apps/web/e2e/helpers/common.ts
  - apps/web/e2e/helpers/msw-route.ts
  - apps/web/playwright.config.ts
  - apps/web/e2e/game-session.spec.ts  # 리팩터 대상
  - apps/web/package.json
```

---

## Tasks

### Task 1 — MSW v2 설치 + 셋업
- `pnpm --filter @mmp/web add -D msw@^2`
- `apps/web/src/mocks/browser.ts`: `setupWorker(...handlers)`
- `apps/web/src/mocks/server.ts`: `setupServer(...handlers)` (Vitest용)
- `apps/web/src/mocks/handlers/index.ts`: 모든 handler 배럴 export

### Task 2 — 초기 handler 4종
- `handlers/auth.ts`: POST /v1/auth/login, GET /v1/auth/me, POST /v1/auth/refresh
- `handlers/theme.ts`: GET /v1/themes (seed 4인 테마 1건), GET /v1/themes/:id
- `handlers/room.ts`: POST /v1/rooms (theme_id만 받아도 PR-1 기준으로 201), GET /v1/rooms/:id
- `handlers/clue.ts`: GET /v1/clues, GET /v1/clue-relations (빈 배열 기본)

### Task 3 — msw-route 어댑터
- `apps/web/e2e/helpers/msw-route.ts`:
  ```ts
  // MSW handler → Playwright page.route 변환
  export async function installMswRoutes(page: Page, handlers: RequestHandler[])
  ```
- MSW Service Worker 대신 Playwright가 request 인터셉트

### Task 4 — common.ts helper
- `login(page, email?, password?)` — 7개 spec의 중복 통합
- `createRoom(page): Promise<roomId>` — createRoom modal 열기 → 테마 선택 → 제출
- `createPartyOfN(browser, n): Promise<{host, guests, roomId}>` — n context × login + join
- `waitForGamePage(pages: Page[], timeout?)` — 전원 동기 대기

### Task 5 — playwright.config.ts fixtures
- `test.extend<Fixtures>({ authenticatedPage, multiPartyContext })`
- fixtures는 `common.ts` helper를 자동 주입

### Task 6 — 기존 spec 리팩터
- `game-session.spec.ts` 1건을 `login()` 공용 helper로 교체
- 테스트 pass 확인 (회귀 없음)

### Task 7 — helper 단위 테스트 + pipeline
- `apps/web/src/mocks/handlers/*.test.ts` (Vitest) — handler shape validation
- `pnpm --filter @mmp/web test` pass
- `pnpm --filter @mmp/web test:e2e game-session.spec` pass
- after_task: format + scope test

---

## 핵심 파일 참조

| 파일 | 역할 |
|------|------|
| `CreateRoomModal.tsx:36-37` | 페이로드 구조 (MSW room.ts 기준) |
| `features/lobby/api.ts:158-165` | createRoom client (MSW가 가로챌 엔드포인트) |
| `editor-golden-path-fixtures.ts:268-281` | 기존 login helper 패턴 |
| `e2e-themes.sql:19-25` | MSW theme.ts 기본 응답 shape 참조 |

---

## 검증

- `pnpm --filter @mmp/web test -- mocks/handlers` pass
- `pnpm --filter @mmp/web test:e2e game-session.spec` pass (리팩터 후)
- `wc -l apps/web/e2e/helpers/common.ts` ≤ 400줄
- 각 handler 파일 ≤ 200줄

---

## 리뷰 포인트

- MSW v2 API 정확성 (http.post / http.get 최신)
- handler 응답 shape이 서버 실제 응답과 일치 (drift 방지)
- Playwright fixtures가 기존 spec 영향 없는지 (opt-in)
- `party` helper의 n=4 기본값, n=1~8 범위 허용
