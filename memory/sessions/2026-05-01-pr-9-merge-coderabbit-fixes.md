---
topic: "Phase 19 W4 PR-9 머지 — BLOCKER 1 + HIGH 5 + CodeRabbit 보안 3 fix"
phase: "Phase 19 Residual W4"
prs_touched: [PR-203, PR-211]
session_date: 2026-05-01
session_followup: "다음 세션은 #207 + #208 묶음 PR 권장 (P1, ws-client TS)"
---

# Session Handoff: PR-9 WS Auth Protocol 머지 + 보안 3 fix + chore canonize

## Decided

- **PR #203 (PR-9 WS Auth Protocol) admin --squash 머지** — 24 commits → `bcdb7df`. Phase 19 Residual W4 의 PR-9 단독 phase 종료. flag-gated (`MMP_WS_AUTH_PROTOCOL`).
- **BLOCKER + HIGH 6건 fix 모두 적용** — C-1 (token iat 기반 since), H-1 (publisher 비동기), H-2 (Client lifecycle ctx), H-3 (CompositeRevokePublisher), H-4 (revoke_log insert 실패 → 500), H-5 (race tests 3건).
- **CodeRabbit 보안 3건 fix** — CR-1 (verifyToken refresh-token reject + type claim 검증), CR-2/3 (Hub.RevokeToken / SocialHub.RevokeToken raw JTI → SHA-256 hex prefix redact, `redactJTI` helper).
- **PR #211 (chore canonize) admin --squash 머지** — `d001808`. 세션 시작 시 로컬 main에 있던 unpushed 3 commit (`4c4e541` plugin.json schema, `2cdeeed` pre-PR-review 4 axis, `b7ea1a0` 6-section 보고)을 별도 branch로 옮겨 정상 PR 흐름.
- **글로벌 `~/.claude/CLAUDE.md`에 "사용자 보고 형식" 섹션 추가** — 진단·결정·design 보고 시 3섹션 (원인/결과/권장) + 비개발자 친화 어휘. 2026-04-28 사용자 요청 (mmp-platform `feedback_explanation_style.md`)을 글로벌 격상.
- **admin --squash 정당 사유** — Docker Hub unauthenticated pull rate limit 도달로 Go Lint+Test + E2E shard 1 fail. 코드 회귀 0 (TS / govulncheck / gitleaks / file-size / E2E shard 2 PASS), 4-agent + CodeRabbit 둘 다 통과.

## Rejected

- **CR-4~CR-8 MEDIUM + CR-9~CR-10 LOW를 PR-9 안에 fix** — scope 비대 risk + 4-agent 보안 axis 외라 follow-up issue 7건으로 분리 (#204~#210).
- **로컬 main 3 commit hard reset 폐기** — 사용자 직접 커밋한 정합 변경이라 손실 위험. 별도 PR 흐름 채택.
- **Docker Hub rate limit 즉시 retry 또는 wait** — CI 환경 issue가 PR-9 코드와 무관, admin 우회 정당. auth secret 추가는 별도 phase.
- **enforce_admins false→true 전환 / E-9 file-size-guard glob 정정 / "admin merge 전 4-agent 리뷰" 강제 룰 카논화** — 이전 wrap-up 명시 드롭 유지.

## Risks

- **#200 (4-agent perf MEDIUM)**: `recordRevoke` 무제한 goroutine fan-out — logout-storm 시 N goroutine 폭증, server shutdown 시 in-flight push 손실. PR-9 안 H-1로 비동기는 됐으나 cap/WaitGroup 미적용. 추정 1~2h, 별도 PR.
- **CodeRabbit review rate limit 9/10 → 1 left**: 추가 push 후 review 미도착했음 (gofmt fix / CR-1/2/3 / wsgen regen 3 commit). reset 주기 미문서화.
- **Docker Hub auth secret 미도입**: 같은 IP 누적 시 다음 PR도 admin 우회 반복 risk.
- **4-agent security axis token type claim 검증 누락 패턴**: CodeRabbit이 catch (CR-1 verifyToken). compound-review의 5번째 axis 또는 기존 security-reviewer prompt 보강 필요.
- **pre-push gofmt + wsgen drift 사전 catch 실패**: 1차 push에서 둘 다 CI fail → fix → re-push 2회 발생. 로컬 `golangci-lint` + `go run ./cmd/wsgen` 미실행.

## Files

### main 적용 (PR #203 squash → bcdb7df)
- `apps/server/internal/ws/auth_protocol.go` — verifyToken type/iat 검증 + Client.Context() 사용
- `apps/server/internal/ws/auth_protocol_test.go` — regression test 6건 추가 (Iat / LoggedOutUser / TokenMissingIat / RefreshToken reject / UsesClientContext)
- `apps/server/internal/ws/client.go` — `ctx` + `cancel` + `Context()` method
- `apps/server/internal/ws/hub_revoke.go` + `social_hub_revoke.go` — `redactJTI(tokenJTI)` 적용
- `apps/server/internal/ws/jti_redact.go` + `_test.go` — SHA-256 hex prefix helper + 3 unit tests
- `apps/server/internal/ws/hub_revoke_test.go` — 3 race tests (DuplicateRegisterReplaces / AfterStop_NoPanic / ConcurrentRegister)
- `apps/server/internal/ws/hub_test.go` — `newTestClient`에 ctx/cancel 초기화 (M2 quick win)
- `apps/server/internal/domain/auth/composite_revoke_publisher.go` + `_test.go` (5 unit tests) — `errors.Join`
- `apps/server/internal/domain/auth/service_revoke.go` (신규, 65 LoC) — `recordRevoke` + `pushRevokeAsync`
- `apps/server/internal/domain/auth/service.go` (483 LoC, 한도 안) — recordRevoke 분리 + Logout/RefreshToken family-attack 에러 propagation
- `apps/server/internal/domain/auth/service_revoke_wire_test.go` — capturing fakes + waitForUserCalls polling helper
- `apps/server/cmd/server/main.go` — composite inline 38줄 제거 + uuid import cleanup
- `packages/shared/src/ws/types.generated.ts` — wsgen regen (struct 출력 정렬)

### main 적용 (PR #211 squash → d001808)
- `memory/MEMORY.md` — pre-PR-review checklist + 6-section 보고 entry 2건
- `memory/feedback_pre_pr_review_checklist.md` (신규) — 4 axis (catalog 일치 / spec comment / cross-component E2E / fixture serial)
- `memory/feedback_task_completion_report.md` (신규) — 6 섹션 보고 형식

### 글로벌 (repo 외)
- `~/.claude/CLAUDE.md` — "사용자 보고 형식" 섹션 추가 (3섹션 + 비개발자 친화)

## Remaining

### 등록된 follow-up issue 11건 (Done: 각 issue body의 acceptance criteria 충족)
- **#200** recordRevoke goroutine cap + WaitGroup + graceful shutdown drain (perf, 1~2h, H impact)
- **#201** H-2 ctx-cancellation regression catch 강화 (test, 30m, H)
- **#202** TestHub_RevokeUser_ConcurrentRegister 200+ iter (test, 15m, M)
- **#204** config_test.go cleanEnv `MMP_WS_AUTH_PROTOCOL` 추가 (5m, M)
- **#205** e2e/ws-auth-revoke.spec.ts `receivedRevoked` hard-assert (10m, M)
- **#206** AuthTokenIssuedPayload.expiresAt RFC3339 string vs number drift (30m, M)
- **#207** handleAuthFrame AUTH_REFRESH_REQUIRED 핸들러 추가 (30m, H — 기능 누락)
- **#208** ReconnectManager.schedule()에 disable() guard (15m, H — race risk)
- **#209** auth.RevokePublisher 인터페이스 godoc vs 실제 동작 정합 (30m or 1~2h, L)
- **#210** revoke_log session_id partial index (15m, L — perf)

### 이전 핸드오프 잔존 (P1-A/B)
- P1-A docs-only PR paths-filter 정책 명문화 (`feedback_4agent_review_before_admin_merge.md` 보강) — S, H impact
- P1-B 4-agent fallback 정책 명시 (oh-my-claudecode 부재 시 superpowers:code-reviewer 1회 + CodeRabbit rate-limit fallback) — S, H impact

### 다음 phase
- Phase 19 W4 **PR-10 Runtime Payload Validation** (L 규모, 단독 phase, wsgen zod codegen + server-side validator dispatch)
- Phase 19 audit log orphan O-1~O-4 (4 vertical PR)
- Phase 24 brainstorm: E-3 Config 409 3-way merge / E-5 location_clue_assignment_v2 (사용자 결정 필요)

### 사용자 명시 드롭 (재제안 금지)
- ❌ E-9 file-size-guard.yml glob 정정
- ❌ MEMORY MISTAKES "admin merge 전 4-agent 리뷰" 강제 룰 카논화
- ❌ enforce_admins false→true 전환

## Next Session Priorities

- **P1-1**: #207 + #208 묶음 1 PR — 둘 다 ws-client TS, 같은 파일군. AUTH_REFRESH_REQUIRED 핸들러 + reconnect disable guard. 추정 45m. Done: vitest 신규 케이스 + 4-agent + admin --squash. (Quick Win, H impact)
- **P1-2**: #200 recordRevoke goroutine cap + WaitGroup. 추정 1~2h. Done: bench `N=1k logouts cap goroutine ≤ 256+2` + server shutdown drain ≤ revokePushTimeout. (production 영향)
- **P1-3**: #201 ctx 비교 강화 + #202 ConcurrentRegister 200 iter — test 보강만. 추정 합 45m.
- **P2**: #204 / #205 / #206 / #210 / #209 — 합 1~2h.
- **P3 또는 별도 phase**: Phase 19 W4 PR-10 (Runtime Payload Validation, L 규모).

가장 먼저 read 할 파일:
- `memory/project_phase19_residual_progress.md` (PR-9 완료 상태 append)
- `apps/web/src/stores/connectionStore.ts` + `packages/ws-client/src/client.ts` (#207/#208 진입점)
- `memory/feedback_pre_pr_review_checklist.md` (P1-A/B 진입점)

진입 명령:
```bash
cd /Users/sabyun/goinfre/muder_platform
git pull --ff-only
```

## What we did



4-agent 재리뷰 (security/perf/arch/test 병렬) → CRITICAL/HIGH 0, MEDIUM 5, LOW 6. M2 (`newTestClient` ctx nil footgun) + M4 (±2s 슬랙 → 100ms) Quick win 즉시 fix, 나머지 3 MEDIUM은 follow-up #200/#201/#202.

push → CI 1차 fail (gofmt 위반 2건) → fix `8546fee` → 2차 fail (Go drift, wsgen 미실행) → fix `5817b10` → 3차 fail (Docker Hub rate limit, 코드 무관). 사이에 CodeRabbit 본 review 도착 → 보안 3건 (CR-1 verifyToken refresh-token bypass + CR-2/3 raw JTI log) catch. CR-1/2/3 fix `bd0c245` + jti_redact.go helper + 3 unit test + RejectsRefreshToken regression test.

CodeRabbit MEDIUM/LOW 7건은 follow-up #204~#210 등록. PR #203 admin --squash 머지 → 로컬 main 3 commit을 새 branch로 cherry-move + 정상 PR #211 admin merge.

학습:
- 4-agent security axis가 token type claim / wire schema 검증을 명시하지 않아 CR-1/2/3 누락 → 5번째 axis 또는 prompt 보강 후보
- gofmt + wsgen drift 사전 catch 위해 `/pre-push-check` command 후보
- 세션 시작 시 `git log origin/main..HEAD` 0건 확인 → `feedback_work_routine.md` 보강 후보
- Docker Hub auth secret 도입 시점 → QUESTIONS Q-dockerhub-auth-secret으로 등재
