# PR-6: Progression 7 modules wired

> Wave 4 (parallel with PR-5, PR-7, PR-8) | 의존: PR-4

## 목적
Progression 7 모듈 (script, hybrid, event, skip_consensus, gm_control, consensus_control, ending)을 PR-4 패턴 복사해 wired. Reading은 PR-4에서 이미 처리됨.

## Tasks
- [ ] `internal/ws/handlers/progression_script.go`
- [ ] `internal/ws/handlers/progression_hybrid.go`
- [ ] `internal/ws/handlers/progression_event.go`
- [ ] `internal/ws/handlers/progression_skip_consensus.go`
- [ ] `internal/ws/handlers/progression_gm_control.go`
- [ ] `internal/ws/handlers/progression_consensus_control.go`
- [ ] `internal/ws/handlers/progression_ending.go`
- [ ] `internal/session/registry_progression.go` — RegisterProgressionHandlers(router, manager) 7개 등록
- [ ] `internal/session/event_mapping_progression.go` — progression 모듈 이벤트 매핑 (phase:changed, gm:override, trigger:transition, consensus:reached 등)
- [ ] `internal/session/registry.go` — RegisterProgressionHandlers 호출 1줄 추가
- [ ] 각 모듈 smoke test
- [ ] ending 모듈 integration test (complete → ending.completed broadcast)
- [ ] strategy 3종 (script/hybrid/event) 각각 e2e test
- [ ] consensus 경로 test (skip_consensus + gm/consensus_control)

## Files 추가
- `internal/ws/handlers/progression_*.go` (7개)
- `internal/session/registry_progression.go`
- `internal/session/event_mapping_progression.go`
- `internal/integration/progression_{script,hybrid,event,ending,consensus}_test.go`

## Files 수정
- `internal/session/registry.go` (1 줄 추가)
- `internal/ws/error_code.go` (Progression 에러 매핑)

## Test coverage
- 3 strategies 각각 smoke test (phase 진행)
- ending 모듈 activation → ending.completed broadcast → snapshot persist
- consensus: 합의 도달 → 자동 phase advance

## Definition of done
- 모든 smoke + integration test pass
- `go test -race ./internal/integration/progression_*` 안정
- **scope 겹침 없음**: PR-5/7/8과 파일 경로 분리
- Progression module factory pattern 검증 (세션별 독립 인스턴스)
- PR 브랜치: `feat/phase-8.0/pr-6-progression-modules`

## Review focus
- Security: GM override 권한, consensus 위조 방어
- Performance: strategy.Advance 호출 빈도, phase 전환 시 snapshot 부담
- Architecture: 3 strategies의 일관성, PhaseReactor 사용 정합성
- Test coverage: 각 strategy의 edge case (skip, timeout, trigger)

## 주의
- `main.go`, 공통 `event_mapping.go`, 공통 `registry.go` 절대 수정 금지
- `internal/session/registry_progression.go` 는 자신만 건드림
- Ending 모듈은 마지막 phase이므로 `reading.completed` 같은 이벤트도 subscribe하여 자동 전환
