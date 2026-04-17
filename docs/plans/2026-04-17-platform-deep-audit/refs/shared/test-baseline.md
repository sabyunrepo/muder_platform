# Test Baseline — Phase 19 감사 W1 고정 수치

> 측정일: 2026-04-17 · 측정자: test-engineer · 브랜치: `chore/phase-19-audit-w1`
> 모든 수치는 main 시점(PR #68 머지 직후). W2 Specialists는 이 문서 수치를 근거로 "테스트가 얼마나 부족한지" 판단.
> 실행 불가능한 항목은 명시적으로 "실측 필요"로 표기. 200줄 제한 유지 — 추가 세부는 `topics/test/<sub>.md`로 분할 예정.

## 축 요약 (3축 총계)

| 축 | 파일 수 | 테스트 수 | 실행 결과 | 커버리지 |
|----|--------|----------|---------|---------|
| Go 백엔드 | 117 `*_test.go` | **988 `func Test*`** | `go test ./...` 전 패키지 PASS | **평균 44.6% (44 측정 pkg)** — 75% 기준 미달 |
| Frontend Vitest | 108 `*.test.{ts,tsx}` | **1034 테스트** | `pnpm vitest run` 108 files / 1034 passed / 0 failed / 0 skipped | 실측 필요 (coverage reporter 미실행) |
| E2E Playwright | 12 `*.spec.ts` | **68 테스트** | 정적 카운트. CI stubbed: 4 pass / 11 skip / 0 fail (Phase 18.8 기록) | N/A |

총합: 테스트 자산 **2090건**, 통합 skip 지시 **35건 (E2E)** + **0건 (Vitest)** + **2건 (Go)**.

## 1. Go 백엔드

### 1.1 테스트 분포 (테스트 파일 Top 10 패키지)

| 패키지 | 테스트 파일 | `func Test*` |
|-------|------------|-------------|
| `internal/session` | 13 | 56 |
| `internal/engine` | 11 | 97 |
| `internal/module/progression` | 8 | 46 |
| `internal/ws` | 7 | 77 |
| `internal/domain/editor` | 7 | 42 |
| `internal/module/crime_scene` | 5 | 86 |
| `internal/module/communication` | 5 | 63 |
| `internal/module/cluedist` | 5 | 76 |
| `internal/e2e` | 5 | — (integration) |
| `internal/template` | 4 | 26 |

### 1.2 커버리지 (`go test -cover ./...` 실측)

커버리지 ≥75% 기준 충족 **9개 패키지**, 50~75% **3개**, ≤50% **32개**.

**상위(≥75%)**: `clue` 97.0 · `health` 100.0 · `auditlog` 90.0 · `engine` 88.7 · `module/core` 88.8 · `template` 88.4 · `config` 86.5 · `module/decision` 86.9 · `module/cluedist` 85.6 · `module/communication` 82.4 · `module/exploration` 80.7 · `seo` 78.9 · `apperror` 78.1 · `module/progression` 78.3.

**경계(50~75%)**: `eventbus` 75.0 · `session` 68.9 · `ws` 63.2 · `module/media` 60.0.

**저커버(≤50%, 우선 보강 후보)**:
- `internal/server` 45.7
- `internal/middleware` 35.3
- `internal/httputil` 33.3
- `internal/domain/flow` 29.0 · `domain/theme` 34.7 · `domain/payment` 25.0 · `domain/room` 23.3 · `domain/admin` 20.3 · `domain/editor` 19.6 · `domain/profile` 17.0 · `domain/social` 14.4 · `domain/auth` 11.6
- `internal/infra/postgres` 26.3 · `infra/cache` 16.1 · `infra/lock` 11.8
- `internal/bridge` 28.3

**0.0% / no-test 패키지 (9개)**: `cmd/server`, `internal/db`, `internal/domain/coin`, `internal/domain/creator`, `internal/domain/sound`, `internal/domain/voice`, `internal/infra/otel`, `internal/infra/sentry`, `internal/infra/storage`. `internal/e2e`는 `[no statements]`, `internal/module`는 `[no test files]`.

### 1.3 mockgen / testcontainers / Skip

| 항목 | 값 | 비고 |
|------|----|----|
| `//go:generate mockgen` 선언 | **0건** | mockgen 사용 0 — 수동 mock 또는 real impl. 결정 근거 재확인 필요 (cross:03) |
| 수동 mock 파일 | 1건 (`domain/payment/mock_provider.go`) | payment provider만 mock |
| `testcontainers` 임포트 파일 | **3건** | `domain/editor/clue_relation_test_fixture_test.go`, `domain/editor/clue_relation_service_test.go`, `auditlog/store_test.go` |
| `t.Cleanup` 사용 | 28건 | fixture teardown 기본 패턴 존재 |
| `t.Skip*` | **2건** | `server/template_handler_test.go:37` (no preset templates), `domain/editor/service_config_test.go:134` (race branch not hit) |

### 1.4 Go 테스트 회귀 지표
`go test -cover ./...` 2026-04-17 실행: **FAIL 0건**, SKIP(패키지 수준) 0건, 실행 시간 총 ≈2분. flaky 발생 이력은 Phase 18.1/18.3 progress에서만 기록(Go는 안정).

## 2. Frontend (Vitest + MSW)

### 2.1 실행 결과 — 2026-04-17 `pnpm vitest run`

```
Test Files  108 passed (108)
Tests       1034 passed (1034)
Duration    21.81s
```

- fail 0 · skip 0 · todo 0 · fixme 0 (정적 grep `\.skip\(` / `\.todo\(` / `\.fixme\(` 도 0)
- `afterEach` / `beforeEach` / `resetHandlers` / `cleanup` 호출 라인 **406건** — 격리 규율 양호.
- MSW handler 모듈 **6개**: `auth`, `clue`, `game-ws`, `index`, `room`, `theme`.
- 커버리지 리포트 미실행 (CI에도 Vitest coverage gate 없음). **실측 필요** — W2 `02-frontend` draft 전 `pnpm vitest run --coverage`로 1회 측정 권장.

### 2.2 테스트 분포 (feature별 hint)

스모크 스캔상 `features/editor/**` 가 가장 많음(≥30 파일), `features/audio/**` 9파일, `features/game/**` 11파일, `features/payment/**` 4파일. `features/admin` / `features/creator/settlement` 등 신규 영역은 **각 1~2 파일** 수준 → W2에서 정량화.

## 3. E2E (Playwright)

### 3.1 Spec 인벤토리 (정적 test 수)

| spec | test 수 | 환경 | 용도 |
|------|--------|-----|-----|
| `clue-relation-live.spec.ts` | 5 | PLAYWRIGHT_BACKEND | live backend |
| `clue-relation-stubbed.spec.ts` | 3 | stubbed | live의 stub 복제본 (Phase 18.8 PR-4) |
| `clue-relation.spec.ts` | 2 | mixed | 레거시 |
| `editor-flow.spec.ts` | 6 | backend gate | 에디터 UI |
| `editor-golden-path.spec.ts` | 9 | mocked UI | Phase 18.4 9시나리오 |
| `front-pages.spec.ts` | 12 | backend gate | 공개 페이지 스모크 |
| `game-reconnect.spec.ts` | 4 | backend gate | WS 재접속 |
| `game-redaction-stubbed.spec.ts` | 5 | stubbed | Phase 18.8 PR-3 stub 복제 |
| `game-redaction.spec.ts` | 5 | PLAYWRIGHT_BACKEND | live |
| `game-session-live.spec.ts` | 4 | PLAYWRIGHT_BACKEND | live |
| `game-session.spec.ts` | 6 | backend gate | 파생 |
| `game-visual.spec.ts` | 7 | backend gate | 시각 회귀 |

합계 **68 테스트**. 최근 CI(stubbed) 실적: **4 pass · 11 skip · 0 fail** (Phase 18.6 recovery 이후 유지).

### 3.2 Skip 지시 분류 (35건 총)

| 카테고리 | 건수 | 대표 위치 | 근본 원인 |
|---------|-----|---------|---------|
| Backend /health gate (백엔드 없으면 자동 skip) | **8** | `editor-flow`, `front-pages:101`, `game-reconnect:18`, `game-redaction:30`, `game-session:16`, `game-visual:18`, … | stubbed CI에는 백엔드 없음. 정책상 허용 |
| `PLAYWRIGHT_BACKEND` env gate (live-only) | **3** | `clue-relation-live:18`, `game-redaction:26`, `game-session-live:24` | 의도적 — nightly만 |
| 선행 상태 미충족 (GamePage/페이즈/테마) | **18** | `game-redaction` 4건, `game-session` 7건, `game-visual` 4건, `game-reconnect` 2건, … | state guard. 신규 스텁 복제본으로 이관 중 (Phase 18.8 PR-5) |
| 데이터 부족 (단서 2개 미만 등) | **3** | `clue-relation-live:58/84/113` | 시드 fixture 미적재 |
| 의도적 단일 skip (`test.skip(true, …)` 고정) | **3** | `game-reconnect:56/153`, editor-flow 파생 | live-only 분기 — 정책 허용 |

### 3.3 Stubbed ↔ Live 복제 매트릭스

| 시나리오 | live spec | stubbed 복제 | 상태 |
|---------|----------|-------------|-----|
| game-redaction | `game-redaction.spec.ts` | `game-redaction-stubbed.spec.ts` (PR-3) | 존재 |
| clue-relation | `clue-relation-live.spec.ts` | `clue-relation-stubbed.spec.ts` (PR-4) | 존재 |
| game-session | `game-session-live.spec.ts` | — | **gap** (Phase 18.8 PR-5 계획) |
| editor-flow | — | `editor-golden-path.spec.ts` (mocked) | 단방향 |
| front-pages | 단일 | — | stub 불필요 |

### 3.4 Flaky / Retry 지표

- Playwright config: `retries: CI ? 2 : 0`. 테스트 단위 `.retry(` / `test.fixme(` **0건**. `@flaky` 태그 **0건** — `flaky-report.yml` 워크플로우는 weekly, 현재 빈 대상.
- Phase 18.1/18.6/18.8 progress에 기록된 flaky 이슈: `H7 MaxPlayers` (Phase 18.8 PR-1에서 수정, `apps/web/src/mocks/handlers/room.ts`), `4-context party WS handshake race` (Phase 18.8 PR-5 대상, `waitForGamePage` 패턴).

### 3.5 Fixture 상태

| 파일 | 줄수 | idempotent? |
|------|-----|------------|
| `apps/web/e2e/helpers/fixtures.ts` | 37 | Phase 18.8 PR-2, opt-in |
| `apps/web/e2e/helpers/common.ts` | 192 | reset 헬퍼 포함 |
| `apps/web/e2e/helpers/editor-golden-path-fixtures.ts` | 281 | Phase 18.4 전용 |
| `apps/web/e2e/helpers/msw-route.ts` | 75 | MSW→page.route 어댑터 (Phase 18.8 PR-2) |
| DB fixture (`*.sql`) | **0건** | Go `testcontainers` + `engine/testdata`만 존재 |

## 4. Scope-matrix 9영역 Gap 플래그 (정량 근거)

| # | 영역 | Gap 신호 | 근거 |
|---|-----|---------|-----|
| 01 go-backend | **중간** | `domain/*` 평균 ~22%, `infra/*` 평균 ~18%, `httputil`/`middleware` ≤35%. 75% 기준 미달 32 패키지 |
| 02 react-frontend | **실측 필요** | Vitest 1034 pass지만 coverage 미측정. Zustand store 단위 테스트 `uiStore` 11건 외 store 테스트 수 재확인 필요 |
| 03 module-architect | **낮음** | `module/*` 평균 82% · `engine` 88.7% — 잘 커버됨. mockgen 0건은 패턴 의도 재확인(cross:03) |
| 04 test-engineer | — | 본 문서 자체 |
| 05 security | **높음 gap** | `middleware` 35.3% · `auditlog` 90% (OK) · `apperror` 78.1% (OK)이나 `domain/auth` 11.6% → 인증 경로 단위 테스트 부족 |
| 06 perf-observability | **매우 높음 gap** | `infra/otel`, `infra/sentry`, `infra/storage` 전부 0.0%. 관측 레이어 검증 공백 |
| 07 design-a11y | **측정 불가** | 접근성(axe) 자동 검사 spec 없음. `game-visual`만 시각 회귀. WCAG 자동화 **실측 필요** |
| 08 docs-navigator | N/A | 테스트 축 밖 |
| 09 ws-contract | **중간** | `internal/ws` 63.2% + `ws/envelope_catalog` 전용 테스트 유무 미확인. 3자 드리프트 정적 테스트 부재 (cross:02, cross:01) |

## 5. 실측 불가 / 후속 필요 항목

1. **Vitest coverage %** — reporter 미활성. W2 실행 전 1회 `pnpm vitest run --coverage` 필요.
2. **E2E stubbed 실측 pass/skip/fail** — Phase 18.8 progress 기록 의존. PR별 재현 시 live 로그 첨부 권장.
3. **axe / a11y 자동 검사** — spec 0건. W2 `07-design-a11y` draft에서 도입 Proposal 기대.
4. **`ws/envelope_catalog` 3자 드리프트 자동 검증** — 현재 수동 review. `mmp-ws-contract` 스킬 + contract test 신설 Proposal 필요 (cross:09).
5. **Go `cmd/server` / `internal/db` / `infra/otel` 등 0% 패키지** — 테스트 전략 결정(의도 제외 vs 추가) 필요.

## 6. 다음 단계

- W2 각 executor는 본 수치를 Finding Evidence로 인용 가능 (`test-baseline.md §N.M`).
- 75% 기준 미달 패키지 32개는 `refs/audits/04-test.md` draft의 P0/P1 후보.
- Vitest coverage · a11y 자동화는 Phase 19 백로그 PR 후보로 승격.
