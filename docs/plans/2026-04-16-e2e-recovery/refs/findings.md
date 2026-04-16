# Phase 18.6 — 초기 조사 findings

## CI 최근 실행 (PR #48 브랜치 — `22135d3`)

- TS/Go/Docker: pass
- E2E: 6/6 tests in `game-session.spec.ts` fail
- 에러 패턴:
  ```
  Test timeout of 30000ms exceeded while running "beforeEach" hook.
  Error: locator.fill: Test timeout of 30000ms exceeded.
  ```
- 스택: `login()` → `page.getByPlaceholder("이메일").fill(LOGIN_EMAIL)`

## 세션 컨텍스트

- `e2e@test.com` user seed → 201 OK
- migrations 22개 전부 OK
- `@mmp/game-logic` workspace build OK
- frontend `pnpm dev` 실행 완료 (vite HMR 준비)

## 가설 (증거 수집 필요)

### H1: placeholder 불일치
- `apps/web/src/features/auth/LoginPage.tsx:119` — `placeholder="이메일"` 유지 확인됨
- 반론: 로컬 `pnpm dev`로 재현 어려움. 혹시 `@jittda/ui` TextField가 placeholder 렌더를 wrapping 하는지?

### H2: 리다이렉트 레이스
- `auth_token` 없는 상태에서 `/login` 접근 시 정상. 그러나 SPA 초기화 중 `useAuthStore` rehydrate가 끝나기 전에 form fill 시도 → element invisible 가능.

### H3: hydration 지연
- React 19 + Vite dev → HMR/SSR 오버헤드. fill 전 `waitForLoadState("networkidle")` 필요?

### H4: 네트워크 실패
- register 직후 seed user로 login은 가능해야 함. 하지만 서버가 restart/reload 중이면 API 거부.

## 다음 probe

1. Playwright trace artifact 다운로드 (PR #48 run id — 통합 후 main의 가장 최근 run 사용)
2. trace viewer로 login 페이지 DOM snapshot 확인 (fill 실패 시점의 HTML)
3. 네트워크 timeline에서 `/api/v1/auth/login` 요청 여부 확인
4. console log에 hydration 에러 있는지

## Seed 필요 자산 (PR-3)

- `themes` 테이블에 published=true 테마 최소 1건
- 연관: `characters`, `clues`, `locations`, `theme_modules` fixture (createRoom 내부에서 요구)
- 현재 migrations 중 `00008_payment.sql`, `00011_editor_tables.sql`까지 스키마 정의됨 — seed SQL은 그 schema 에 부합
