---
topic: "Phase 19 W4 PR-9 — WS Auth Protocol Task 1 + 1.5 + 2 (envelope + payload + revoke_log)"
phase: "Phase 19 Residual W4"
prs_touched: [PR-9 (in-flight, branch feat/pr-9-ws-auth-protocol)]
session_date: 2026-05-01
---

# Session Handoff: PR-9 WS Auth Protocol — Task 1, 1.5, 2 완료

## Decided

- **개발 우선 정책 카논화** — `memory/feedback_dev_work_priority.md` 신설. 활성 Phase feature 개발이 핸드오프 P1 메타 작업(카논 명문화·CI yaml·PR 회고)보다 우선. 메타 끌어올리기 예외 4가지 명시. 발동 첫 사례가 본 세션 (Phase 19 W4 진입).
- **PR-9 worktree 분기** — `feat/pr-9-ws-auth-protocol` (base main `64b1bc1`). path: `/Users/sabyun/goinfre/muder_platform.wt/pr-9-ws-auth-protocol`.
- **Task 1 — envelope 6 active 전환** (`e4dd9a9`) — `envelope_catalog_system.go` auth.identify/resume/refresh (C2S) + auth.challenge/revoked/refresh_required (S2C) 6 entry를 StatusStub→Active. `auth_payloads.go` 신규 (6 //wsgen:payload struct). types.generated.ts active 115→121, payload 2→8.
- **Task 2 — migration 00027 + sqlc generate** (`99d369f` + `93a6495`) — `revoke_log` 테이블 (user_id NOT NULL + session_id/token_jti/revoked_by NULL + code CHECK constraint 4종) + 5 query (Insert/IsUserRevokedSince/IsToken/IsSession/ListRecent) + 인덱스 2종 (user_id revoked_at DESC + 부분 token_jti). sqlc 1.31.1 brew install + generate.
- **Task 1.5 — 외부 리서치 보강** (`72de7ab`) — OpenID CAEP 1.0 / Discord Gateway / OWASP WebSocket cheatsheet / Auth0 docs 검증 결과 2 envelope 추가:
  - `auth.token_issued` (S2C) — refresh 응답 dedicated event (videosdk 2025 / websockets.readthedocs 권고). piggyback 회피.
  - `auth.invalid_session` (S2C) — Discord INVALID_SESSION 패턴. resumable bool로 "buffer expired, re-identify OK" vs "fully unauthorized" 분기. auth.revoked와 의미 분리.
  - 결과: catalog 132 events, active 123, payload struct 10.
- **Task 3 디자인 결정 합의** (코드 미작성, 다음 세션 진입점):
  - JWT 재사용 (`domain/auth/token.go` GenerateAccessToken 활용 — 새 token 인프라 도입 X)
  - **Push 모델 + RevokePublisher interface 추상화** — `domain/auth/revoke_publisher.go` 신규 interface. Hub가 in-process 구현, multi-server 시 Redis pub/sub adapter로 swap. 표준: OpenID CAEP 1.0 (2025-08-29) + OWASP "close immediately on logout".
  - revoke_log은 audit + 재접속 시 IsTokenRevoked/IsUserRevokedSince 조회 (Auth0 hybrid: push + reconnect pull fallback) — 자동 충족.
  - feature flag `MMP_WS_AUTH_PROTOCOL` default off. catalog는 unconditionally Active (codegen 안정).

## Rejected

- **piggyback refresh 응답** — 외부 리서치에서 dedicated event 권고. type-safe + ordering 명확.
- **단일 auth.revoked** — resume failure와 user revoke 의미 혼재. invalid_session으로 분리.
- **Pull 모델 broadcast middleware** — hot path DB hit, 표준 권고 X. push trigger + reconnect pull fallback이 hybrid 표준.
- **Slack overlap pattern (parallel new connection on refresh)** — robust하지만 PR-9 scope 외. follow-up 후보.

## Risks

- **sqlc 버전 marker drift** — `internal/db/*.sql.go` 18 파일이 v1.30.0→v1.31.1 (brew installed 가 1.31.1, 기존 generated은 1.30.0). 동작 영향 0 but PR-9 diff 잡음. follow-up: Makefile target + tool directive로 sqlc 버전 pin (별도 chore PR 권장).
- **Hub.RevokeUser interface 미구현** — Task 3.1 첫 작업. interface 미리 추출 안 하면 multi-server 마이그레이션 시 grep-and-replace 비용.
- **Server-side mutation re-validation 가정** — 즉시 close 안전 전제는 매 mutation에서 user.revoked 재검증. 현재 코드 확인 필요 (Task 3.5 wiring 시 검증).
- **다중 서버 미지원** — Push 모델은 single instance 가정. instance #2 추가 시 RevokePublisher interface가 swap point.

## Files

### 신규 (worktree branch)
- `apps/server/internal/ws/auth_payloads.go` (8 payload struct + Discord-style 시퀀스 주석)
- `apps/server/db/migrations/00027_ws_auth_revoke_log.sql`
- `apps/server/db/queries/revoke_log.sql`
- `apps/server/internal/db/revoke_log.sql.go` (sqlc generated)

### 수정
- `apps/server/internal/ws/envelope_catalog_system.go` — 6 stub → 8 active (token_issued + invalid_session 추가)
- `apps/server/internal/db/models.go` — RevokeLog 모델 추가 + sqlc v1.31.1 marker
- `apps/server/internal/db/*.sql.go` (18 파일) — sqlc v1.30.0→1.31.1 marker bump only
- `packages/shared/src/ws/types.generated.ts` — header drift (132 events, active 123, payload 10)
- `memory/feedback_dev_work_priority.md` (신규, main canonical)
- `memory/MEMORY.md` — 인덱스 1줄 추가

### Branch commits
- `e4dd9a9` Task 1: catalog active + payload struct
- `99d369f` Task 2 part 1: SQL files
- `93a6495` Task 2 part 2: sqlc generate
- `72de7ab` Task 1.5: token_issued + invalid_session (외부 리서치 반영)

## Remaining

### PR-9 Task 3-7 (sub-step spec은 task description 참조)

- **Task 3.1**: `domain/auth/revoke_publisher.go` (interface) + `domain/auth/revoke.go` (RevokeRepo sqlc 래퍼) + table-driven test (testcontainers postgres) — TDD red→green
- **Task 3.2**: `ws/auth_protocol.go` auth.identify 핸들러 + flag 게이트 + test — TDD red→green
- **Task 3.3**: `ws/auth_protocol.go` auth.resume + auth.refresh + auth.token_issued/invalid_session 송신 + test — TDD red→green
- **Task 3.4**: `ws/hub_revoke.go` Hub.RevokeUser (RevokePublisher impl) + close + test — TDD red→green
- **Task 3.5**: `auth/service.go` logout-elsewhere/password change → InsertRevoke + RevokePublisher.RevokeUser wiring (mutation re-validation 점검 포함)
- **Task 3.6**: `config/flags.go` MMP_WS_AUTH_PROTOCOL + main.go DI 와이어업
- **Task 4**: `packages/ws-client/src/` reconnect.ts + client.ts — auth.resume 자동 송신 + auth.invalid_session 분기 (resumable bool 처리) + auth.token_issued 토큰 swap
- **Task 5**: 단위 테스트 (Go + TS RTL/MSW)
- **Task 6**: E2E `apps/web/tests/e2e/ws-auth-revoke.spec.ts` — revoke→30s WS close + 재접속 거부 (W4 Gate 검증)
- **Task 7**: `/compound-review` 4-agent + PR 생성 (cover letter에 외부 리서치 references + 8 envelope 보강 명시)

### follow-up (PR-9 외)
- Makefile target + go.mod tool directive로 sqlc 버전 pin (chore PR S 규모)
- Slack overlap refresh pattern 도입 (Phase 22+ 후보)
- Multi-server Redis pub/sub RevokePublisher subscriber adapter (Phase 22+ 후보)

## Next Session Priorities

- **P0-A**: Task 3.1 진입 — `domain/auth/revoke_publisher.go` interface + `domain/auth/revoke.go` sqlc 래퍼 + table-driven test (TDD red 먼저). 첫 sub-task가 가장 명확.
- **P0-B**: Task 3.4 (Hub.RevokeUser) 와 Task 3.1 (RevokePublisher interface) 는 동일 interface 양쪽이라 sister task. 3.1 → 3.4 순서 자연.
- **P1**: 진입 직전 `apps/server/internal/auth/service.go` + `apps/server/internal/admin/handler.go` 의 mutation paths read — Task 3.5 wiring 비용 사전 확인.

가장 먼저 read 할 파일: 본 핸드오프 + `docs/plans/2026-04-21-phase-19-residual/checklist.md` (PR-9 spec L156-162).

---

## What we did

세션 시작 시 사용자 호소 ("개발 작업을 하고 싶은데 자꾸 다른 거 한다고 개발이 하나도 안된다") → 우선순위 큐 진단. 직전 5 PR (#192~#196) 모두 메타/CI/wrap-up. 활성 Phase 19 W4 PR-9가 P2로 밀려있던 구조였다. `feedback_dev_work_priority.md` 카논화로 메타 후순위 명문화 (메타 끌어올리기 예외 4건만 허용).

PR-9 진입 — Task 1 (envelope active 전환) 외과적 1 commit. Task 2 (migration + sqlc) 진행 중 sqlc CLI 부재 발견. brew install sqlc 1.31.1 후 generate. 5 query Go 코드 정상 생성, 단 기존 18 파일 v1.30.0→1.31.1 marker drift (동작 영향 0).

Task 3 디자인 결정 직전 사용자 요청으로 외부 표준 리서치 (2 axes 병렬 dispatch — Discord/Phoenix/Slack/AWS IoT 4 reference + JWT revoke 5 axes). 핵심 발견 3건: (a) `auth.token_issued` dedicated event 필요 (b) `auth.invalid_session` resumable 분기 필요 (Discord INVALID_SESSION) (c) Hub.RevokeUser를 interface로 추출 (multi-server hedge). 사용자 합의 (Q1~Q4 모두 권장 채택) 후 Task 1.5 회귀 commit.

다음 세션 진입점이 명확해서 (Task 3.1 RevokePublisher interface) 자연스러운 분기. Task 3-7은 다음 세션부터 TDD red→green 사이클로.
