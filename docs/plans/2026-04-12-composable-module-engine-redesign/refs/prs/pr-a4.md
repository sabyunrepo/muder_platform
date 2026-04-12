# PR-A4 — PhaseEngine + Legacy Deletion + Rename (빅뱅)

**Wave**: 2 · **Parallel**: ×2 (with A5) · **Depends on**: A1, A2, A3 · **Worktree**: required

## Scope globs
- `apps/server/internal/engine/phase_engine.go` (new)
- `apps/server/internal/engine/phase_engine_test.go` (new)
- **DELETE**: `engine/engine.go`, `engine/strategy_*.go` (3개), `engine/strategy_test.go`, `engine/dispatcher.go`, `engine/dispatcher_test.go`, `engine/validation.go`, `engine/validation_test.go`, `engine/types.go` (legacy 부분), `engine/registry.go` (legacy), `engine/eventbus.go` (legacy callback)
- **DELETE**: `apps/server/internal/eventbus/**` (패키지 통째)
- **RENAME**: engine.Plugin → engine.Module 전역 (A1 임시명 제거)
- `apps/server/internal/module/**/*.go` (32 파일 재배선, 새 인터페이스 구현)
- `apps/server/internal/session/session.go` (재배선)
- `apps/server/internal/session/manager.go` (재배선)
- `apps/server/internal/session/panic_internal_test.go`

## Context
PR-A4 는 "빅뱅 cutover" — A1/A2/A3 에서 추가된 신규 코드가 레거시를 **전부** 대체한다.
Feature flag 없음. 리버트 = 레거시 전체 복원.

## Tasks

1. **phase_engine skeleton** — JSON template 구동 phase machine, `Step(event)` 메서드, panic isolation
2. **phase_engine tests** — golden tests, panic recover 검증
3. **legacy delete** — GameProgressionEngine, strategies, dispatcher, validation, eventbus 삭제
4. **rename** — `engine.Plugin → engine.Module` 전역 (gopls rename tool). 추가로 `engine.PluginConfigSchema → engine.ConfigSchema` 복구 리네임 — PR-A1 이 legacy `engine.ConfigSchema` **interface** 와의 충돌을 피하려고 신규 struct 를 `PluginConfigSchema` 임시명으로 등록했음. legacy `types.go` 삭제 후 rename 필요.
5. **rewire module/** — 32 파일 새 `Module` interface 구현 (Core 7 필수, Optional 는 opt-in)
6. **rewire session/** — NewEngine 호출부 → NewPhaseEngine, Module wire
7. **integration test** — session 생성 → phase 진행 → cleanup e2e 1 케이스

## Verification
- `go build ./...` clean
- `go vet ./...` clean
- `go test -race ./...` all green (전체 레포)
- `go mod tidy` no diff
- 삭제 파일 목록 PR description 에 명시
- Rollback plan: PR revert = 레거시 복원

## Parallel-safety notes
- A5 (Validator) 는 engine/validator.go 만 건드림 → A4 의 파일 삭제와 충돌 없음
- W2 의 A4/A5 는 W1 전체 머지 후 시작 — user 승인 게이트 필수

## Risk
- 이 PR 이 가장 큰 diff. 리뷰 집중도 높게 가져갈 것
- 4 병렬 reviewer (security/perf/arch/test-coverage) 의무
