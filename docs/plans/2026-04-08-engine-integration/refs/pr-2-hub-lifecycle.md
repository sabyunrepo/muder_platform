# PR-2: Hub lifecycle listener

> Wave 1 (parallel with PR-1) | 의존: PR-0

## 목적
WS Hub에 `SessionLifecycleListener` interface 추가 + disconnect/reconnect 콜백 경로 구축.

## Tasks
- [ ] `internal/ws/lifecycle.go` — SessionLifecycleListener interface 정의
- [ ] `internal/ws/hub.go` — RegisterLifecycleListener 메서드 추가, listeners slice + mutex 추가
- [ ] `internal/ws/hub.go` — run() 이벤트 루프의 unregister 경로에 notifyPlayerLeft 호출 추가
- [ ] `internal/ws/hub.go` — JoinSession에 reconnect 감지 로직 + notifyPlayerRejoined 호출
- [ ] reconnect 감지 기준: 같은 playerID가 sessions[sid]에 이미 존재 OR 최근 N초 내 unregister 기록
- [ ] `internal/ws/hub_test.go` — RegisterLifecycleListener test, notify 호출 순서 test
- [ ] `internal/ws/hub_lifecycle_test.go` — disconnect → listener OnPlayerLeft 수신, reconnect → OnPlayerRejoined

## Files 추가
- `internal/ws/lifecycle.go` (~40 lines: interface + docs)
- `internal/ws/hub_lifecycle_test.go`

## Files 수정
- `internal/ws/hub.go` — listener 등록/호출 코드 추가
- `internal/ws/hub_test.go` — 기존 test 유지 + 새 test 추가

## Test coverage
- hub_test: RegisterLifecycleListener로 복수 listener 등록 가능
- hub_lifecycle_test: fake listener로 OnPlayerLeft/OnPlayerRejoined 호출 검증
- race test: listener 등록과 notify 동시 실행 시 안전

## Definition of done
- 위 모든 test pass
- `go test -race -count=10 ./internal/ws/...` 안정
- PR-1과 **scope 겹침 없음** (internal/ws/hub.go vs internal/session/**)
- PR 브랜치: `feat/phase-8.0/pr-2-hub-lifecycle`

## Review focus
- Security: listener 등록 시 권한 체크 불필요 (내부 API)
- Performance: RLock으로 listener slice 순회, 호출 빈도 낮음 — 성능 영향 무시
- Architecture: 단방향 의존 (Hub → interface ← Manager). Hub가 SessionManager를 직접 알지 않음
- Test coverage: listener slice 동시 수정 + notify, disconnect 후 reconnect 빠른 시나리오
