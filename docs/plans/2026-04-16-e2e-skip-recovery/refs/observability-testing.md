# Phase 18.8 — Observability & Testing

> 부모: [../design.md](../design.md)

---

## 검증 시나리오

### PR-1 — 서버 optional 수용

| # | 시나리오 | 기대 |
|---|---------|------|
| 1 | `POST /v1/rooms { theme_id: T }` (MaxPlayers 생략) | 201 + `response.max_players = theme.max_players` (=8) |
| 2 | `POST /v1/rooms { theme_id: T, max_players: 6 }` (범위 내) | 201 + `response.max_players = 6` |
| 3 | `POST /v1/rooms { theme_id: T, max_players: 1 }` (테마 min 미달) | 400 VALIDATION_ERROR |
| 4 | `POST /v1/rooms { theme_id: T, max_players: 99 }` (테마 max 초과) | 400 VALIDATION_ERROR |

### PR-2 — MSW foundation 동작

| # | 시나리오 | 기대 |
|---|---------|------|
| 1 | Vitest에서 `setupServer(auth)` → `login()` 호출 | MSW가 가로채 200 반환 |
| 2 | Playwright에서 `msw-route(auth+theme)` 후 `login()` → lobby 렌더 | 성공 |
| 3 | `createPartyOfN(browser, 4)` | 4 context 병렬 LobbyRoom 도달 |
| 4 | helper 없이 기존 `game-session.spec`이 여전히 pass | 회귀 없음 |

### PR-3 — redaction 검증

| # | 시나리오 | 기대 |
|---|---------|------|
| 1 | 범인 역할 수신 시 | `secret_card.contents != "???"` |
| 2 | 일반/탐정 역할 수신 시 | `secret_card.contents == "???"` |
| 3 | whisper 발신자≠수신자 | 해당 메시지 DOM 미출현 |
| 4 | 역할 카드 영역 role-scoped 데이터만 표시 | PASS |

### PR-4 — clue-relation 검증

| # | 시나리오 | 기대 |
|---|---------|------|
| 1 | 단서 2개 이상 시 노드 렌더 | React Flow node count ≥2 |
| 2 | 엣지 있으면 edge 렌더 | edge count ≥1 |
| 3 | 노드 클릭 → 관련 엣지 하이라이트 | class 변경 |

### PR-5 — CI gate

| # | 시나리오 | 기대 |
|---|---------|------|
| 1 | main push 후 real-backend workflow 자동 실행 | run 생성 |
| 2 | 의도적 실패 커밋 후 revert | 실패 run + 알림 도달 (staging 채널) |
| 3 | `workflow_dispatch`로 PR에서 수동 실행 | run 생성 가능 |

---

## 메트릭

| 지표 | 시작 | 목표 | 측정 방법 |
|------|------|------|----------|
| E2E pass 수 | 4 | ≥13 | Playwright JSON report 파싱 |
| E2E skip 수 | 11 | ≤3 | 동일 |
| E2E fail 수 | 0 | 0 | 동일 |
| stubbed CI 소요 | ~8분 | ≤10분 (MSW 로드로 소폭 증가 허용) | workflow run duration |
| real-backend nightly green streak | 0 | ≥3 | run history |

---

## Flaky 가드

| 패턴 | 대책 |
|------|------|
| WS handshake race (party helper) | 전원 LobbyRoom 진입 `Promise.all` + timeout 30s + retry 3 |
| MSW worker register 타이밍 | `page.waitForLoadState("networkidle")` 후 fetch |
| React Flow layout race | `graph.react-flow__node` 개수 expect + toHaveCount |
| real-backend Postgres startup | healthcheck `pg_isready` 루프 (기존 유지) |

---

## 로깅

- 서버 PR-1: theme fallback 발생 시 `info` 로그 `room.create theme-fallback theme_id=<...> max_players=<...>`
- Playwright: `trace: "retain-on-failure"` (CI) — trace.zip 업로드
- real-backend workflow: server stdout 전체를 artifact (기존 유지)

---

## 에러 분류

| 코드 | 상황 |
|------|------|
| `VALIDATION_ERROR` | PR-1 범위 벗어남 |
| `ROOM_THEME_NOT_FOUND` | theme_id 존재 안 함 |
| (e2e) `PartyTimeout` | party helper 내 guest 중 1명 LobbyRoom 미도달 |
| (e2e) `PhaseTimeout` | GamePage 페이즈 전환 타임아웃 |

---

## 알림

- staging Slack `#e2e-staging` (3일 관측 기간)
- 3일 green 이후 `#ci-alerts` main 채널 이관 (Phase 18.9에서)
