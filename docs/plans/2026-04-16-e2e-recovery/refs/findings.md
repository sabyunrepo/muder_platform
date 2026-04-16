# Phase 18.6 — W0 PR-1 findings (CONFIRMED)

## 요약

**근본 원인**: CI `Build workspace packages` step이 `@mmp/ws-client`를 빌드하지 않아 Vite dev가 패키지 entry resolve 실패 → React SPA 부팅 실패 → `/login` 페이지 렌더 안 됨 → `getByPlaceholder("이메일")` 30s timeout.

가설 H1~H4는 전부 기각. 새 H5가 확정 원인.

## 증거

### E1 — CI Vite 에러 (run #24497907923, Start frontend step, 07:34:47.3Z)

```
✘ [ERROR] Failed to resolve entry for package "@mmp/ws-client".
The package may have incorrect main/module/exports specified in its package.json.
[plugin vite:dep-scan]
  at packageEntryFailure (vite/dist/node/chunks/dep-D4NMHUTW.js:16198:15)
  at resolvePackageEntry (vite/dist/node/chunks/dep-D4NMHUTW.js:16195:3)
  at tryNodeResolve (vite/dist/node/chunks/dep-D4NMHUTW.js:16060:18)
```

Vite는 302ms에 ready 표시 후 즉시 에러 발생. 이후 `curl http://localhost:3000`은 성공하지만 HTML response는 빈/error 상태로 React 앱이 load되지 않음.

### E2 — workflow step 누락 (`.github/workflows/e2e-stubbed.yml:130-131`)

```yaml
- name: Build workspace packages
  run: pnpm --filter "@mmp/game-logic" --filter "@mmp/shared" build
```

`@mmp/ws-client`, `@mmp/ui-tokens` 빌드 누락.

### E3 — ws-client package.json entry (`packages/ws-client/package.json`)

```json
"main": "./dist/index.js",
"exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } }
```

로컬에는 `packages/ws-client/dist/index.js`가 존재하지만 CI 워크스페이스는 clean checkout이므로 `dist/` 없음. `pnpm dev`는 dist에 의존.

### E4 — Playwright 에러 체인

```
locator.fill: Test timeout of 30000ms exceeded.
  waiting for getByPlaceholder('이메일')
```

Vite가 앱을 제공하지 못하므로 placeholder가 영원히 없음 → 30s timeout → 12건 연쇄 실패(6 tests × retry).

## 가설 판정

| # | 가설 | 상태 | 판정 근거 |
|---|------|------|----------|
| H1 | placeholder 불일치 | ❌ 기각 | 소스 line 119에 `placeholder="이메일"` 존재 |
| H2 | 리다이렉트 레이스 | ❌ 기각 | isAuthenticated는 기본 false, fresh context |
| H3 | hydration 지연 | ❌ 기각 | 앱이 아예 부팅 안 됨 (hydration 이전 실패) |
| H4 | 네트워크 실패 | ❌ 기각 | seed user는 201 OK, API 정상 |
| **H5** | **workspace package 미빌드** | ✅ **확정** | Vite vite:dep-scan 에러, @mmp/ws-client 패키지 entry resolve fail |

## 수정 계획

**원 PR-2/PR-3 스코프 재편성 필요.**

### 신규 PR-3 (1차 수정, W1 최우선)
- `.github/workflows/e2e-stubbed.yml`: `--filter "@mmp/ws-client"` + `--filter "@mmp/ui-tokens"` 추가 (또는 `pnpm -r build`)
- 단독 적용 후 CI 재돌려 `Start frontend` 에러 사라지는지 확인

### PR-3 (기존 theme seed)
- `apps/server/db/seed/e2e-themes.sql` 신규: published theme + characters + clues fixture
- workflow `Seed E2E theme` step 추가 (Seed user 다음)

### PR-2 (login helper 공용화)
- 여전히 가치 있음: 3개 spec이 동일한 login() 로직 복붙 → helper 추출
- 하지만 H1~H4 기각됐으므로 placeholder 수정은 불필요, 순수 리팩터링

## 다음 Task

W1 PR-3(workspace build 수정)을 최우선으로 실행. E1 에러 해결되면 다음 run에서 테마 없음/테마 seed 필요 문제가 노출될 것이므로 theme seed PR도 병행.

---

## 2차 findings (PR #50 run `24499509545`, 2026-04-16)

### 확인된 것 (ws-client fix 성공)

- 서버 로그: login 200, `/api/v1/auth/me` 200, `/api/v1/themes` 200 모두 정상
- Vite `vite:dep-scan` 에러 사라짐 — `@mmp/ws-client` dist build 성공 (6.49KB)
- 로그인 폼 placeholders found, 폼 제출도 성공

### 새 문제 (H6): ThemeCard 프론트/백 계약 불일치

error-context.md 스냅샷:
```
heading "오류 발생" [level=1]
Cannot read properties of undefined (reading 'toLocaleString')
```

**원인**: `apps/web/src/features/lobby/components/ThemeCard.tsx` 가 server JSON에 없는 필드를 참조.

| Server (`theme.service.go`) | Frontend (`ThemeCard.tsx`) |
|-----------------------------|----------------------------|
| `min_players`, `max_players` | `player_count_min`, `player_count_max` |
| `duration_min` | `duration_minutes` |
| `cover_image` | `thumbnail_url` |
| (없음) | `play_count`, `rating`, `difficulty` |

Theme seed 이전엔 `themes` 테이블이 비어 있어 ThemeCard가 렌더되지 않아 숨겨진 버그였음. PR-3 seed가 **드러낸** 장기 부채.

### 의사 결정

- **PR-3 스코프 축소**: ws-client workflow fix만 유지. Seed step은 workflow에서 제거(SQL 파일은 future PR용으로 보존).
- **H6 해결**은 별도 PR(PR-4 또는 신규 phase)로 이관. Theme seed 재활성화는 contract 정렬 후.
- 이번 PR로 login `beforeEach` 통과 → createRoom 이후는 NO_THEMES skip으로 graceful. E2E gate에서 1단계 진전.
