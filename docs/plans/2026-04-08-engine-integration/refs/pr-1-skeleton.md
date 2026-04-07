# PR-1: SessionManager + Session actor skeleton

> Wave 1 (parallel with PR-2) | 의존: PR-0

## 목적
Actor 패턴의 core 구조 (Manager + Session goroutine + inbox) skeleton 구축. Lock-free, channel-based.

## Tasks
- [ ] `internal/session/types.go` — SessionMessage, MessageKind, SessionStatus, PlayerState types
- [ ] `internal/session/manager.go` — SessionManager struct, Start/Stop/Get/Restore (Restore는 stub)
- [ ] `internal/session/session.go` — Session struct, Run(ctx) event loop, handleMessage with panic recover
- [ ] `internal/session/panic_guard.go` — 3회 누적 abort 로직
- [ ] `internal/engine/` — lock (sync.RWMutex) 제거, 외부 호출자는 actor 통해서만 접근 강제
- [ ] `internal/session/manager_test.go` — lifecycle test (Start/Stop/Get)
- [ ] `internal/session/session_test.go` — actor loop test, message dispatch test
- [ ] `internal/session/panic_test.go` — panic recovery + 3회 abort 시나리오

## Files 추가
- `internal/session/{types,manager,session,panic_guard}.go`
- `internal/session/{manager,session,panic}_test.go`

## Files 수정
- `internal/engine/engine.go` — mu field 제거, 모든 메서드에서 Lock/Unlock 제거

## Test coverage
- manager_test: Start → Get 반환 확인, Stop → Get nil 반환, 동시 Start 방지
- session_test: inbox에 메시지 보내기 → reply 채널 수신 → 순서 보장
- panic_test: 1회 panic → session 생존, 3회 panic → session abort + done 닫힘
- **race detector 필수**: `go test -race ./internal/session/...`

## Definition of done
- 위 모든 test pass
- `go test -race -count=10 ./internal/session/...` 안정
- engine.go 에 sync.Mutex/RWMutex 없음
- 외부에서 engine 메서드 직접 호출 경로 제거 확인 (grep)
- PR 브랜치: `feat/phase-8.0/pr-1-session-manager`

## Review focus (4 reviewers)
- Security: sessionID forgery 방어, panic에서 민감정보 노출 방지
- Performance: inbox buffer 크기 적정성, goroutine leak 가능성
- Architecture: lock-free 원칙 준수, engine 의존 방향
- Test coverage: race 테스트, goroutine leak 검출, panic 카운터 경계
