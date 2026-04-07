# PR-5: Core 4 modules wired

> Wave 4 (parallel with PR-6, PR-7, PR-8) | 의존: PR-4

## 목적
Core 4 모듈 (connection, room, ready, clue_interaction)을 PR-4 패턴 그대로 복사해 wired.

## Tasks
- [ ] `internal/ws/handlers/core_connection.go` — connection 메시지 핸들러
- [ ] `internal/ws/handlers/core_room.go` — room 메시지 핸들러
- [ ] `internal/ws/handlers/core_ready.go` — ready 합의 핸들러
- [ ] `internal/ws/handlers/core_clue_interaction.go` — 단서 상호작용 핸들러
- [ ] `internal/session/registry_core.go` — RegisterCoreHandlers(router, manager) 4개 등록
- [ ] `internal/session/event_mapping_core.go` — Core 모듈 이벤트 매핑 (connection/room/ready/clue 각각)
- [ ] `internal/session/registry.go` — RegisterCoreHandlers 호출 1줄 추가
- [ ] 각 모듈 smoke test: `internal/integration/core_<module>_test.go`
- [ ] 각 모듈의 apperror → WS error 매핑 추가 (ws/error_code.go 확장)

## Files 추가
- `internal/ws/handlers/core_{connection,room,ready,clue_interaction}.go`
- `internal/session/registry_core.go`
- `internal/session/event_mapping_core.go`
- `internal/integration/core_{connection,room,ready,clue}_test.go`

## Files 수정
- `internal/session/registry.go` (1 줄 추가)
- `internal/ws/error_code.go` (Core 모듈 에러 매핑 추가)

## Test coverage
- 각 모듈 smoke test: handler 등록 확인 + 기본 메시지 → 응답 흐름
- integration: 가짜 client로 모듈 기본 시나리오 실행

## Definition of done
- 4 smoke test 모두 pass
- `go test -race ./internal/integration/core_*` 안정
- **scope 겹침 없음**: PR-6 (progression), PR-7 (snapshot), PR-8 (api)과 파일 경로 분리
- PR 브랜치: `feat/phase-8.0/pr-5-core-modules`

## Review focus
- Security: 각 모듈의 권한 검증 로직 (host-only actions 등)
- Performance: handler 등록 수 증가에 따른 router lookup 영향
- Architecture: PR-4 패턴 정확히 복사됐는지 (drift 없음)
- Test coverage: 모든 Core 메시지 type 커버

## 주의
- `main.go` 절대 수정 금지 (registry.go만 편집)
- `internal/session/event_mapping.go` (공통) 절대 수정 금지 — event_mapping_core.go만 편집
- 이유: PR-6과 동시 작업이라 merge 충돌 방지
