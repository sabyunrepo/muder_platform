# PR-4: Reading module wired (pattern reference)

> Wave 3 (sequential) | 의존: PR-3

## 목적
기존 Phase 7.7에서 작성된 `ReadingWSHandler` + `ReadingModuleAdapter` + `ReadingSessionResolver`를 **실제로 instantiate + 등록**. 이 PR이 모든 후속 모듈 wiring의 **패턴 레퍼런스**.

## Tasks
- [ ] `internal/ws/handlers/reading.go` — 기존 `internal/ws/reading_handler.go`를 이 위치로 이동 (서브디렉터리화)
- [ ] `internal/session/registry_reading.go` — RegisterReadingHandlers(router, manager) 함수
- [ ] `internal/session/event_mapping_reading.go` — reading.* → reading:* 매핑 (reading.started 포함 camelCase 변환 함수 포함)
- [ ] `internal/session/registry.go` 호출 등록 — RegisterAllHandlers에서 RegisterReadingHandlers 호출
- [ ] 기존 bridge/reading_bridge.go는 그대로 유지 (camelCase 변환 재사용)
- [ ] PhaseAction `start_reading_section` → ReadingModule.Init config에 sectionID 주입 경로 구현
- [ ] `internal/integration/reading_e2e_test.go` — 가짜 client 2개 (host + player) → host가 reading:advance → 모두가 reading:line_changed 수신
- [ ] `internal/integration/reading_disconnect_test.go` — host disconnect → reading:paused broadcast, reconnect → reading:resumed
- [ ] `internal/integration/reading_snapshot_test.go` — 재접속 시 current line snapshot push 수신

## Files 추가/이동
- `internal/ws/handlers/reading.go` (기존 파일 이동)
- `internal/session/registry_reading.go` (~30 lines)
- `internal/session/event_mapping_reading.go` (~60 lines — camelCase 변환 포함)
- `internal/integration/reading_e2e_test.go`
- `internal/integration/reading_disconnect_test.go`
- `internal/integration/reading_snapshot_test.go`

## Files 수정
- `internal/session/registry.go` (Reading 호출 추가)
- `cmd/server/main.go` — **수정 없음** (registry 팩토리가 자동 등록)

## Test coverage
- reading_e2e_test: 전체 wire contract 검증 (message → handler → session → engine → eventBus → mapping → broadcast)
- disconnect_test: lifecycle listener 경로 검증
- snapshot_test: BuildState → wire → 전송 검증

## Definition of done
- 모든 integration test pass
- Phase 7.7에서 만든 ReadingModule이 처음으로 **end-to-end 작동**
- 패턴 확정: 다른 모듈 wiring은 이 PR을 template으로 복사
- **`docs/plans/2026-04-08-engine-integration/refs/module-wiring-guide.md` 생성** (PR-5/6 위한 가이드)
- PR 브랜치: `feat/phase-8.0/pr-4-reading-wired`

## Review focus
- Security: ReadingWSHandler의 권한 검증 (기존 Phase 7.7 로직 유지)
- Performance: EventMapping subscribe 경로, broadcast 경로
- Architecture: registry 패턴이 깔끔한지 (PR-5/6 복사 가능한지)
- Test coverage: disconnect 후 paused event, reconnect snapshot 양방향

## 후속 PR 패턴 가이드
PR-5/6는 이 PR을 복사:
1. `internal/ws/handlers/<module>.go` 작성
2. `internal/session/registry_<category>.go` 작성
3. `internal/session/event_mapping_<category>.go` 작성
4. `internal/session/registry.go` 한 줄 추가
