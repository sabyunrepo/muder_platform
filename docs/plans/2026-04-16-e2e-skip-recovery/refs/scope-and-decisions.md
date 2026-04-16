# Phase 18.8 — Scope & 7대 결정 상세

> 부모: [../design.md](../design.md)

---

## 1. Scope

### In scope

| 카테고리 | 항목 | 근거 |
|---------|------|------|
| Backend | `CreateRoomRequest.MaxPlayers` optional + theme fallback | H7 루트. Phase 18.6→18.7 이관 후 미해결 |
| E2E 인프라 | MSW v2 foundation (HTTP SSOT) | 계약 drift 예방 (H6/H7 재발 방지) |
| E2E 인프라 | Playwright fixtures + common helpers | 7개 spec login 중복 제거 |
| 멀티플레이 | `createPartyOfN(n=4)` | 머더미스터리 본질 시나리오 |
| 검증 깊이 | Investigation 단서 수신까지 | redaction spec과 시너지, Voting은 후속 |
| Stub 복제 | `game-redaction-stubbed`, `clue-relation-stubbed` | stubbed CI에서 redaction/clue 회귀 감지 |
| CI | real-backend main push post-merge 관측 | 3일 green 축적 → required 승격 전 단계 |
| CI | `workflow_dispatch` 확장 | PR 필요 시 수동 real-backend 검증 |

### Out of scope

- Voting/엔딩 페이즈 커버리지 → Phase 19.0
- real-backend `required` 승격 → Phase 18.9 (3일 green 달성 후)
- MSW 핸들러를 Storybook/Vitest와 공유 → Phase 19.0 SSOT 확장
- `PLAYWRIGHT_BACKEND` env gate 3 spec 원본 수정 (nightly 유지)

---

## 2. 7대 결정 상세

### 결정 1 — Scope: **C (최대)**
- A (H7만) / B (H7+stub) / **C (H7+stub+multi-context+CI)**
- 선택: C. 이유: 회귀 방지망을 런타임 전반으로 확장. 머더미스터리 특성상 멀티플레이 검증은 필수.

### 결정 2 — H7 아키텍처: **서버 optional + theme fallback**
- 탐색 결과: FE `CreateRoomModal`은 이미 `theme_id`만 전송 → FE 변경 불필요
- 서버: `MaxPlayers *int32` + `omitempty` + nil 시 `theme.MaxPlayers` 사용
- 범위 검증은 `theme.MinPlayers` ~ `theme.MaxPlayers`로 theme-relative
- `rooms.max_players` 컬럼은 NOT NULL 유지 (저장 시점엔 항상 값)

### 결정 3 — Multi-user lifecycle: **P1 단일 테스트 N-context**
- P1 / P2 (fixture) / P3 (solo 1인 테마)
- 선택: P1. `browser.newContext()` × 4 → host/guest 분리 제어
- `createPartyOfN(browser, 4)` helper로 길이 문제 관리 (각 spec 150줄 이내)

### 결정 4 — Stub 기술: **혼합 (HTTP MSW + WS page.route)**
- MSW v2는 HTTP의 SSOT. Vitest·Playwright·dev 공유 가능
- WS는 MSW v2 지원 불안정 → Playwright `page.route()`/`page.routeWebSocket()` 사용
- 기존 `editor-golden-path-fixtures.ts` (page.route) 패턴과 공존
- 어댑터 `msw-route.ts`로 MSW handler를 page.route로 변환 가능하게

### 결정 5 — Persistence: **기존 `e2e-themes.sql` 재사용**
- 이미 min=4, max=8, PUBLISHED, 4 캐릭터 — 요구 충족
- 추가 seed 파일 불필요

### 결정 6 — 운영 안전성: **점진적 CI gate**
- main push post-merge 관측 (알림 전용, required 아님)
- 3일 연속 green → 별도 후속 PR(Phase 18.9)에서 required 승격
- 최초 3일 알림은 staging 채널, 안정화 후 main 채널로

### 결정 7 — 도입 전략: **3 Wave / 5 PR / worktree 병렬**
- W1 Foundation (PR-1, PR-2) parallel — 서로 독립
- W2 Stub (PR-3, PR-4) parallel — W1 완료 후
- W3 CI (PR-5) sequential — 전체 완료 후 관측 시작

---

## 기각된 대안

| 대안 | 기각 사유 |
|------|----------|
| A (H7만) | 회귀 방지망 확장 목표 미달 |
| ①FE가 MaxPlayers 전송 | UI 변경 필요, 테마 min/max 조정 UI 논쟁 유발 |
| γ 3 spec 모두 stubbed + real 중복 | 유지비 2배, 가치 중복 |
| R2 main push required gate | flaky 1건이 팀 전체 차단 — 베타 단계 과도 |
| P2 fixture | WS 세션 race + lifecycle 복잡, 단일 테스트 N-context가 명확 |
