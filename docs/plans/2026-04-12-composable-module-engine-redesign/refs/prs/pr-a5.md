# PR-A5 — Validator Chain

**Wave**: 2 · **Parallel**: ×2 (with A4) · **Depends on**: A1 · **Worktree**: required

## Scope globs
- `apps/server/internal/engine/validator.go` (new)
- `apps/server/internal/engine/validator_test.go` (new)

## Context
레거시 `validation.go` 는 A4 에서 삭제됨. A5 는 대체 validator chain 을 미리 만들어 A4 의 session 재배선이 이를 사용하도록 함.

## Tasks

1. **interface** — `Validator` interface (`Validate(ctx, event, state) error`), `Chain` type ([]Validator)
2. **builtin** — `PhaseValidator` (현재 phase 에서 허용된 action 인지), `PlayerValidator` (플레이어 존재/상태), `ModuleValidator` (각 모듈 `GameEventHandler.Validate` 위임)
3. **chain exec** — short-circuit on first error, apperror 반환
4. **tests** — 각 builtin + chain composition

## Verification
- `go build ./...` clean
- `go test -race ./internal/engine/...` all green
- 신규 파일 커버리지 ≥ 85%

## Parallel-safety notes
- A4 는 validator.go 를 **import 만** 하고 수정하지 않음 → 충돌 없음
- A5 머지 순서: A1 머지 후 언제든. A4 와 독립 worktree
- A4 의 session 재배선은 A5 의 `Chain` 타입을 사용하므로 A5 선 머지 권장 (또는 A4 가 임시 stub 후 rebase)
