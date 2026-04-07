# PR-3: BaseModuleHandler + EventMapping infra

> Wave 2 (sequential) | 의존: PR-1, PR-2

## 목적
WS 핸들러의 boilerplate를 공통 헬퍼로 추출 + EventMapping 테이블 인프라 + SessionManager가 Hub의 SessionLifecycleListener 구현하도록 연결.

## Tasks
- [ ] `internal/ws/base_module_handler.go` — BaseModuleHandler struct + WithSession 헬퍼 (sessionID 검증 + manager.Get/Restore + inbox 전송 + reply 타임아웃 2s)
- [ ] `internal/ws/base_module_handler_test.go` — fake manager로 WithSession 동작 검증
- [ ] `internal/session/event_mapping.go` — EventMapping struct, GameEventMappings 슬라이스 (빈 상태), subscribeMappings 함수
- [ ] `internal/session/event_mapping_test.go` — 매핑 등록 + convert 함수 호출 test
- [ ] `internal/session/registry.go` — RegisterAllHandlers(router, manager) 팩토리 (빈 상태로 생성, 각 PR에서 추가)
- [ ] `internal/session/manager.go` 확장 — SessionLifecycleListener 구현 (OnPlayerLeft/OnPlayerRejoined → inbox forwarding)
- [ ] `cmd/server/main.go` 최소 수정 — SessionManager 인스턴스 생성 + hub.RegisterLifecycleListener(manager) + session.RegisterAllHandlers(router, manager) 추가
- [ ] feature flag `MMP_ENGINE_WIRING_ENABLED` 체크: false면 manager가 no-op stub
- [ ] `internal/session/lifecycle_test.go` — OnPlayerLeft → session.inbox에 KindLifecycleLeft 메시지 도달 검증

## Files 추가
- `internal/ws/base_module_handler.go` (~80 lines)
- `internal/ws/base_module_handler_test.go`
- `internal/session/event_mapping.go` (~70 lines)
- `internal/session/event_mapping_test.go`
- `internal/session/registry.go` (~40 lines)
- `internal/session/lifecycle_test.go`

## Files 수정
- `internal/session/manager.go` (listener impl 추가)
- `cmd/server/main.go` (manager 주입 + flag check)
- `internal/config/config.go` (EngineWiringEnabled 필드)

## Test coverage
- base_module_handler_test: fake manager + WithSession 2초 타임아웃 시나리오
- event_mapping_test: mapping 등록, Publish → subscriber 호출 → broadcast mock 검증
- lifecycle_test: listener 호출 → inbox 메시지 수신

## Definition of done
- 위 test pass
- `go test -race ./internal/ws/... ./internal/session/...` 안정
- main.go 빌드 성공 (flag false 기본값)
- **이 PR 머지 후 main.go는 절대 수정 금지** (PR-4부터는 registry_*.go만)
- PR 브랜치: `feat/phase-8.0/pr-3-base-handler`

## Review focus
- Security: WithSession의 sessionID 검증 엄격성
- Performance: Reply 채널 leak 방지 (타임아웃 시 drain)
- Architecture: main.go DI 배치, 의존 방향
- Test coverage: 2초 타임아웃 + replies 채널 cleanup
