# PR-8: Game start API + abort + idle timeout

> Wave 4 (parallel with PR-5, PR-6, PR-7) | 의존: PR-4

## 목적
`POST /api/v1/rooms/{id}/start` 엔드포인트 + host 검증 + ready 검증 + SessionManager.Start 호출 + abort + idle timeout.

## Tasks
- [ ] `internal/domain/room/handler_game.go` — HandleStart, HandleAbort 핸들러
- [ ] `internal/domain/room/service_game.go` — StartGame(roomID, host) → validate + SessionManager.Start
- [ ] Validation: 호스트 확인 (요청자 = room.host), 모든 player ready, theme.configJson valid (ValidateConfig)
- [ ] `POST /api/v1/rooms/{id}/start` 라우트 등록 (authed + RequireRole host 또는 room host 검증)
- [ ] `POST /api/v1/rooms/{id}/abort` 라우트 (host-only)
- [ ] Idle timeout: Session 내부에 lastActivity 추적, 10분 초과 + 모든 player disconnected → auto abort
- [ ] `internal/session/session.go` — idle timeout check in Run() (1분마다)
- [ ] Game session 시작 broadcast: `session:started` 이벤트 (roomID, sessionID)
- [ ] `internal/domain/room/handler_game_test.go` — start/abort unit test
- [ ] `internal/integration/game_start_test.go` — e2e start → engine running → abort → engine stopped
- [ ] `internal/integration/idle_timeout_test.go` — 모두 disconnect + 10분 경과 → auto abort (fake clock)

## Files 추가
- `internal/domain/room/{handler_game,service_game,handler_game_test}.go`
- `internal/integration/game_start_test.go`
- `internal/integration/idle_timeout_test.go`

## Files 수정
- `internal/session/session.go` — idle check
- `cmd/server/main.go` — 라우트 등록 (**예외적으로 main.go 수정 허용**: 새 endpoint 2개 추가, registry 패턴 밖의 HTTP 라우트라 어쩔 수 없음)
- `internal/domain/room/room.go` (기존 파일) — sessionID 필드 추가

## Test coverage
- handler_game_test: start 요청 → validation fail 케이스들 (non-host, not all ready, invalid config)
- game_start_test: 성공 시나리오 → sessionID 반환 → engine running 확인
- idle_timeout_test: fake clock으로 10분 경과 → SessionManager.Get nil 반환

## Definition of done
- 위 test pass
- feature flag off 상태에서는 start API가 501 반환 확인
- Fake clock 주입 패턴 확립 (idle test 용)
- PR 브랜치: `feat/phase-8.0/pr-8-game-start-api`

## Review focus
- Security: **host 권한 엄격 검증**, race condition (동시 start 방지), session 중복 생성 방지
- Performance: idle check 주기 (1분 ticker) 적정성
- Architecture: room domain과 session manager의 경계
- Test coverage: 동시 start 요청, abort 중 snapshot 진행 상태

## 주의
- **main.go 수정은 예외적으로 허용** — 라우트 등록 2줄만. scope가 다른 PR과 겹치지 않도록 `r.Route("/rooms", ...)` 블록 안에서만 추가
- Room.sessionID 필드 추가는 DB 마이그레이션 필요 (00018+) — 이 PR에 포함
