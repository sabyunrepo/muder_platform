---
topic: "Phase 19 W4 PR-9 — Task 3.1~6 완료 + 4-agent 리뷰 결과 (BLOCKER 1 + HIGH 5)"
phase: "Phase 19 Residual W4"
prs_touched: [PR-9 (in-flight, branch feat/pr-9-ws-auth-protocol, 15 commit ahead)]
session_date: 2026-05-01
session_followup: "옵션 B 확정 — 다음 세션이 BLOCKER + HIGH 5건 모두 fix 후 PR 생성"
---

# Session Handoff: PR-9 Task 3.1~6 완료 + 4-agent 리뷰 결과

## Decided

- **Task 3.1~6 모두 완료** — 13 feature/test commit (Task 3.1 RevokeRepo/Publisher → Task 6 E2E spec). worktree commit chain 그대로.
- **Wire format dot-form 채택** — `auth.identify` (점). retro fix commit `f58eb46` 가 Go Type 상수 8 개 colon → dot 정렬. main.go router.Handle 도 3 entries 로 explicit 등록 (router 의 colon split 우회).
- **Social Hub 도 RevokePublisher** — manual E2E 가 폭로. commit `204e413` 신규 `social_hub_revoke.go` + main.go `compositeRevokePublisher` inline + socialRouter 에 auth.* 등록.
- **Manual E2E 통과** — Test 1 (logout→close): 997ms / Test 2 (revoked→재접속 거부): 218ms. W4 30s budget 안 (마진 큼).
- **4-agent 리뷰 완료** — security/perf/arch/test 병렬. 결과는 아래.
- **3 follow-up issue 등록** — #197 (mutation re-validation), #198 (admin ban handler), #199 (password change handler). 각각 Phase A~F 단계별 작업 계획 + acceptance + estimate.
- **사용자 옵션 B 확정** — 다음 세션이 BLOCKER + HIGH 5 건 모두 fix → 4-agent 재리뷰 → PR 생성.

## Risks (다음 세션이 fix 할 BLOCKER + HIGH)

### 🔴 BLOCKER — main 머지 전 반드시 fix

**C-1. `IsUserRevokedSince(userID, time.Time{})` → production flag-on 시 mass user lockout**
- 위치: `apps/server/internal/ws/auth_protocol.go:275` (`userRevokedAndStop` 안)
- 메커니즘: `time.Time{}` (epoch 0) since → SQL `WHERE user_id=$1 AND revoked_at > $2` 가 user 의 *모든* 과거 revoke 매치. service.Logout (service.go:323) 이 매번 RevokeCodeLoggedOutElsewhere row insert. 결과: logout 한 번 한 user 가 재로그인 후 ws 접속 시 `auth.revoked` 받고 즉시 close — flag-on 환경에서 mass lockout.
- spec/migration 주석 (00027:39-42, "newer than the connection's auth timestamp") 자체는 정확 — 구현이 spec 어긋남.
- **Fix**: JWT `iat` claim 파싱해서 since 로 전달. verifyToken 에서 이미 claims 접근 중 (auth_protocol.go:243). claims["iat"] 를 time.Time 으로 변환해서 userRevokedAndStop 에 같이 넘김.
- **Regression test 필수**: `TestAuthHandler_Identify_LoggedOutUser_CanRelogIn` — logout 후 새 token 으로 identify → 통과 (현재 fail).
- **검증 axis**: perf + security 양쪽 동시 발견.

### 🟠 HIGH — fix 권장

**H-1. `recordRevoke` 동기 publisher fan-out → logout HTTP p99 5s+ 지연**
- 위치: `apps/server/internal/domain/auth/service.go:137-142` + `apps/server/cmd/server/main.go:417-454`
- 메커니즘: `compositeRevokePublisher.RevokeUser` 가 publishers slice serial iterate. 각 Hub.RevokeUser 가 c.SendMessage (256-cap channel) + c.Close + h.Unregister. wedged client socket 에서 WriteMessage 10s writeWait → logout HTTP 응답까지 stall.
- **Fix**: compositeRevokePublisher.RevokeUser 안에서 publisher 별 goroutine fire-and-forget. service.recordRevoke 의 publisher 호출도 비동기 권장. audit row + revoke_log row 는 동기 유지 (보안 enforcement).
- **검증**: bench 100 concurrent logout + 1 wedged socket (`tc qdisc add dev lo root netem delay 5s`) → p99 logout < 500ms 보장.

**H-2. `verifyToken`/`userRevokedAndStop` 가 `context.Background()` → zombie goroutine 누적**
- 위치: `apps/server/internal/ws/auth_protocol.go:212` (refresher.RefreshToken), `:275` (revoke.IsUserRevokedSince)
- 메커니즘: client disconnect 해도 Redis SCAN / DB call 취소 안 됨. 부하 시 누적.
- **Fix**: Hub 또는 Client 에 lifecycle ctx 노출. AuthHandler.Handle signature 에 ctx 추가 또는 Client 가 자체 ctx 보유 (close 시 cancel). 작은 리팩터.

**H-3. `compositeRevokePublisher` main.go inline 38 줄 + `firstErr` silent 누적**
- 위치: `apps/server/cmd/server/main.go:417-454`
- 메커니즘: Composite 패턴이 main.go 에 inline → Redis pub/sub adapter 추가 시 불편. firstErr 가 첫 publisher 실패만 보임 — 두 publisher 모두 실패 시 silent.
- **Fix**: `apps/server/internal/ws/composite_revoke_publisher.go` (또는 internal/domain/auth/) 로 추출. `errors.Join(err1, err2)` 사용. 단위 테스트 추가 (publisher 1/2/all 실패 케이스).

**H-4. `recordRevoke` best-effort 정책 — insert 실패 + push 성공 시 policy 우회**
- 위치: `apps/server/internal/domain/auth/service.go:126-143`
- 메커니즘: revoke_log insert 실패 + push 성공 → 다음 reconnect 의 pull-fallback 빈 ledger 통과 → 사용자 다시 접속 가능. 반대(insert OK, push 실패) 도 라이브 socket 살아남음.
- **Fix 옵션**:
  - (a) insert 실패 → ERROR 격상 + Logout 자체 500 응답 (best-effort 포기)
  - (b) transactional outbox 패턴 (audit_events 와 한 트랜잭션)
  - (c) alert metric 추가 + design doc 으로 trade-off 명시
- **권장**: (a) 가 가장 안전, (c) 가 가장 가벼움. (a) 로 결정 시 Logout 시그니처 변경 영향 검토.

**H-5. Test 누락 3건 — race 시나리오 검증 부재**
- 누락 시나리오:
  1. **Multi-device revoke fan-out** — Hub.players 가 단일 매핑이라 같은 user 의 두 socket register 시 두 번째가 첫 번째 덮어씀 가정. 그 가정 자체가 미검증. → `TestHub_RevokeUser_DuplicateRegisterReplacesPrevious` 추가.
  2. **Hub.Stop() 후 RevokeUser** — Stop 이 players map nil 화 (`hub.go:172`). 이후 RevokeUser 호출 시 panic 가능성. → `TestHub_RevokeUser_AfterStop_NoPanic` 추가.
  3. **Concurrent RevokeUser × Register race** — 같은 userID register 와 revoke 가 동시 → race 가능. → `TestHub_RevokeUser_ConcurrentRegister` (`go test -race`) 추가.
- **Fix**: hub_revoke_test.go 에 3 테스트 추가. 발견된 panic/leak 은 hub_revoke.go 에서 별도 fix.

## Files (이번 세션 commit 들의 핵심 파일)

### 신규 (worktree)
- `apps/server/internal/domain/auth/revoke.go` (RevokeRepo + RevokeEntry + RevokeRecord + 4 RevokeCode 상수 + NoopRevokeRepo)
- `apps/server/internal/domain/auth/revoke_publisher.go` (RevokePublisher interface + NoopRevokePublisher)
- `apps/server/internal/domain/auth/revoke_test.go` (testcontainers + 5 sub + 2 unit)
- `apps/server/internal/domain/auth/service_revoke_wire_test.go` (4 wire tests + capturing fakes)
- `apps/server/internal/ws/auth_protocol.go` (AuthHandler + Type 상수 8 + verifyToken/userRevokedAndStop helpers)
- `apps/server/internal/ws/auth_protocol_test.go` (~25 sub-tests, table-driven, FakeWebSocket-style fakes)
- `apps/server/internal/ws/hub_revoke.go` (Hub.RevokeUser/Session/Token + var _ guard)
- `apps/server/internal/ws/hub_revoke_test.go` (8 tests + waitForChannelClosed helpers)
- `apps/server/internal/ws/social_hub_revoke.go` (SocialHub.RevokeUser + 2 no-op stubs + var _ guard)
- `packages/ws-client/src/client.test.ts` (11 vitest)
- `packages/ws-client/src/reconnect.test.ts` (3 vitest)
- `packages/ws-client/src/__tests__/fake-websocket.ts` (hand-rolled mock)
- `packages/ws-client/vitest.config.ts`
- `apps/web/e2e/ws-auth-revoke.spec.ts` (Playwright 2 시나리오, serial)

### 수정
- `apps/server/internal/domain/auth/service.go` (NewService signature 확장 + recordRevoke helper + Logout/RefreshToken 와이어링)
- `apps/server/internal/config/config.go` (WSAuthProtocol flag)
- `apps/server/internal/config/config_test.go`
- `apps/server/cmd/server/main.go` (revokeRepo 인스턴스화 + authSvc 위치 이동 + wsAuthHandler 등록 + compositeRevokePublisher inline + socialRouter 등록)
- `apps/server/internal/domain/auth/handler_audit_test.go` (NewService 호출 update)
- `packages/ws-client/src/client.ts` (authProtocol 분기 + 4 콜백 + sessionId/lastSeq 추적)
- `packages/ws-client/src/reconnect.ts` (disable())
- `packages/ws-client/src/types.ts` (4 옵션 추가)
- `packages/ws-client/package.json` (vitest devDep)
- `apps/web/src/stores/connectionStore.ts` (authRevoked state + 콜백 wire)

### main 영향 (별개 commit)
- `b7ea1a0` (main) — `feedback_task_completion_report.md` 카논 (6섹션 보고 형식)

### Branch commits (worktree, main..HEAD = 15)
- `e4dd9a9` Task 1: catalog active + payload struct
- `99d369f` Task 2 part 1: SQL files
- `93a6495` Task 2 part 2: sqlc generate
- `72de7ab` Task 1.5: token_issued + invalid_session
- `84550ac` Task 1+1.5+2 핸드오프
- `2c5a077` Task 3.1: RevokePublisher + RevokeRepo
- `1af7cfc` Task 3.2: AuthHandler.identify + flag gate
- `d3a8d08` Task 3.3: resume + refresh
- `4bce75e` Task 3.4: Hub.RevokeUser
- `ef93d67` Task 3.5: service.go 와이어링
- `3a6ffd0` Task 3.6: main.go DI
- `f58eb46` retro fix: dot-form 정렬
- `63afe62` Task 4: TS client 새 프로토콜
- `8aedf72` Task 5: vitest 도입 + 14 tests
- `af52735` Task 6: E2E spec
- `204e413` E2E manual 발견 fix: SocialHub revoke + spec serial

## Remaining (다음 세션 진입점)

### 옵션 B 작업 (우선순위 순)

1. **C-1 fix** (BLOCKER): JWT iat 기반 since
   - `auth_protocol.go` verifyToken 가 claims 반환하도록 + userRevokedAndStop signature 에 since time.Time 추가
   - regression test (logout 후 새 token 재로그인 → identify 통과)
   - 추정: 30~45분
2. **H-1 fix**: 비동기 publisher fan-out
   - main.go compositeRevokePublisher.RevokeUser 안 goroutine wrap (또는 service.recordRevoke 의 publisher 호출 비동기)
   - bench 검증
   - 추정: 30분
3. **H-2 fix**: ctx 주입 패턴
   - Client 에 lifecycle ctx 노출 또는 Hub.shutdownCtx 활용
   - AuthHandler.Handle 시그니처 확장
   - 추정: 1시간
4. **H-3 fix**: composite 추출 + errors.Join
   - `apps/server/internal/ws/composite_revoke_publisher.go` 신규 (또는 internal/domain/auth/)
   - 단위 테스트 (publisher 1/2/all 실패 케이스)
   - 추정: 30~45분
5. **H-4 fix**: best-effort 정책 결정
   - 사용자 결정 필요: (a) insert 실패 시 Logout 500 격상 / (b) outbox / (c) metric only
   - 권장 (a) — 보안 enforcement 책임
   - 추정: 30분~2시간 (옵션 따라)
6. **H-5 fix**: 3 race test 추가
   - hub_revoke_test.go 에 추가. 발견 시 hub_revoke.go fix
   - 추정: 1시간
7. **4-agent 재리뷰** (변경 사항만)
8. **gh pr create** — cover letter (외부 리서치 + retro fix + social fix + manual E2E 결과 + follow-up issues link + BLOCKER fix 명시)
9. **branch push** — origin/feat/pr-9-ws-auth-protocol

총 추정: **5~8시간** (사용자 결정 포함).

### follow-up (PR-9 외, 이미 issue 등록)
- #197 mutation re-validation
- #198 admin ban handler
- #199 password change handler

## Next Session Priorities

- **P0**: C-1 fix (BLOCKER — 무조건 PR 전). 진입 명령:
  ```
  cd /Users/sabyun/goinfre/muder_platform.wt/pr-9-ws-auth-protocol
  ```
  그 후 `auth_protocol.go:230~280` (verifyToken + userRevokedAndStop) read.
- **P1**: H-1, H-2 (production 영향 큼). 순서 무관.
- **P2**: H-3, H-4, H-5 (구조/안정성).
- **P3**: 재리뷰 + PR 생성.

가장 먼저 read 할 파일:
- 본 핸드오프
- `apps/server/internal/ws/auth_protocol.go`
- `apps/server/internal/domain/auth/service.go`
- `apps/server/cmd/server/main.go` (compositeRevokePublisher 부분)

dev 환경 재기동:
```bash
cd /Users/sabyun/goinfre/muder_platform.wt/pr-9-ws-auth-protocol
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis
goose -dir apps/server/db/migrations postgres "postgres://mmp:mmp_dev@localhost:25432/mmf?sslmode=disable" up
# server: cd apps/server && DATABASE_URL=... REDIS_URL=... MMP_WS_AUTH_PROTOCOL=true go run ./cmd/server
# vite (E2E 시): cd apps/web && VITE_MMP_WS_AUTH_PROTOCOL=true pnpm dev
# spec: pnpm exec playwright test e2e/ws-auth-revoke.spec.ts --workers=1
```

## Learnings (이번 세션 미스테이크 4건 — 카논 후보)

### M-1. Wire format verify 부족 — catalog vs handler 양쪽 안 봄
- Task 3.2 시작 시 reading_handler.go 의 colon-form 만 보고 카논으로 가정. catalog (`auth.identify` dot-form) + 자동 생성 TS WsEventType 와 mismatch. retro fix commit `f58eb46` 필요 (Type 상수 8 + main.go 3 entries).
- **카논화**: 신규 wire 추가 시 *catalog 와 wire 양쪽* 확인 필수. Phase 19 audit F-ws-* 의 dot/colon 부조화 노트도 참조.

### M-2. workers=2 + same fixture user → false positive
- 첫 manual E2E 시 시나리오 1 이 1.1s "PASS" — 실은 시나리오 2 의 second register 가 SocialHub single-session enforcement 로 첫 번째 socket 을 silent close 한 것. 진짜 PR-9 push 가 아닌 부수효과로 close.
- **카논화**: 동일 fixture user 사용하는 spec 은 `test.describe.configure({ mode: "serial" })` 강제. CI workers config 와 별개로 spec 자체 명시.

### M-3. SocialHub publisher 미와이어링 — unit test 만으로는 cross-hub 검증 부족
- Task 3.6 commit 시 "social Hub publisher follow-up" 으로 명시. 그러나 manual E2E 가 *진짜 acceptance gate* 검증 시 social close 자체가 안 됨을 폭로 (commit `204e413` 필요했음).
- **카논화**: 다중 component 회로 (game+social, 또는 multiple publisher) 는 *unit test 가 아닌 manual E2E* 가 회로 완결성 검증의 단일 신뢰 source.

### M-4. spec comment 와 구현 일치 review 누락 — since=time.Time{} BLOCKER
- migration 00027 의 SQL comment ("newer than the connection's auth timestamp as `since`") 가 정확한 spec. 그러나 auth_protocol.go 의 호출 (`time.Time{}`) 이 spec 어긋남. unit test 도 zero TTL 의미 매치만 검증해서 missed. 4-agent 리뷰 (perf + security 동시) 가 발견.
- **카논화**: review checklist 에 *"spec comment / migration comment 와 구현이 일치하는지"* 명시. 미래 review 시 catalog/migration 주석을 ground truth 로 사용.

## What we did

세션 시작 시 사용자 호소 ("작업 출력만 나오고 뭘 한 건지 모르겠다, blackbox") → 6섹션 보고 형식 카논화 (`feedback_task_completion_report.md`, main commit `b7ea1a0`). 그 후 Task 3.1~6 차례로 진행:

- **Task 3.1** (commit `2c5a077`): RevokePublisher interface + RevokeRepo (sqlc 래퍼 + testcontainers 통합 테스트 5 sub).
- **Task 3.2** (`1af7cfc`): AuthHandler + auth.identify + flag gate + 9 단위 테스트.
- **Task 3.3** (`d3a8d08`): auth.resume + auth.refresh + AuthRefresher interface + verifyToken/userRevokedAndStop 헬퍼 추출 + 9 새 테스트.
- **Task 3.4** (`4bce75e`): Hub.RevokeUser/Session/Token + 8 단위 테스트.
- **Task 3.5** (`ef93d67`): service.go 와이어링 (Logout + RefreshToken family-attack) + recordRevoke 헬퍼 + 4 wire 테스트.
- **Task 3.6** (`3a6ffd0`): main.go DI — wsHub 뒤로 authSvc 이동 (순환 의존 풀이) + wsAuthHandler 등록.
- **retro fix** (`f58eb46`): dot-form 정렬 (Type 상수 8 + main.go 3 entries).
- **Task 4** (`63afe62`): TS client 자동 auth.identify/resume + 4 콜백 + ReconnectManager.disable().
- **Task 5** (`8aedf72`): vitest 도입 + 14 tests + FakeWebSocket.
- **Task 6** (`af52735`): Playwright E2E spec (2 시나리오).

Task 6 manual E2E 시도 → 환경 셋업 (docker postgres+redis + goose migrate + e2e@test.com register + Go server + vite) → 첫 시도 둘 다 fail → 결함 발견:
1. Origin "null" (about:blank) 거부 → page.goto vite origin 으로
2. Workers=2 + same user false positive → serial mode
3. SocialHub publisher 미구현 → social_hub_revoke.go 신규 + main.go composite + socialRouter 등록 (`204e413`)

manual E2E 재실행 → 둘 다 PASS (997ms / 218ms, W4 budget 안).

3 follow-up issue 등록 (#197 mutation re-validation, #198 admin ban handler, #199 password change handler) — 각각 Phase A~F 단계별 작업 계획 + acceptance + estimate.

4-agent 병렬 리뷰 spawn (security/perf/arch/test, code-reviewer subagent). 통합 결과:
- BLOCKER 1 (mass user lockout — perf+security 동시 발견)
- HIGH 5 (logout latency / zombie ctx / composite inline / best-effort policy / race test 누락)
- MEDIUM 9, LOW 다수
- 자세한 발견은 위 Risks 섹션

사용자 옵션 B 확정 (BLOCKER + HIGH 5 모두 fix → 재리뷰 → PR). 다음 세션 핸드오프.
