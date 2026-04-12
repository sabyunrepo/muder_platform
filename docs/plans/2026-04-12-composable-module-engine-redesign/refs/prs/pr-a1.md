# PR-A1 — Module Core + Optional Interfaces + Registry

**Wave**: 1 · **Parallel**: ×3 · **Depends on**: none · **Worktree**: required

## Scope globs
- `apps/server/internal/engine/module.go` (new)
- `apps/server/internal/engine/module_optional.go` (new)
- `apps/server/internal/engine/module_types.go` (new)
- `apps/server/internal/engine/module_registry.go` (new)
- `apps/server/internal/engine/module_test.go` (new)

## Context
레거시 `engine.Module` 인터페이스가 32 파일에서 쓰이므로 PR-A1 은 신규 인터페이스를
**`Plugin*` 임시명** 으로 추가 (공존). PR-A4 에서 레거시 삭제 + `Plugin → Module` 리네임.

## Tasks (1 commit each)

1. **types** — `module_types.go`: GameEvent (UUID, json.RawMessage), GameState, Phase, PhaseDefinition, WinResult, Rule
2. **core** — `module.go`: `Plugin` interface 7 메서드 (ID/Name/Version/GetConfigSchema/DefaultConfig/Init/Cleanup)
3. **optional** — `module_optional.go`: 5 interfaces (GameEventHandler/WinChecker/PhaseHookPlugin/SerializablePlugin/RuleProvider)
4. **registry** — `module_registry.go`: `PluginRegistry` struct, factory 패턴, panic on dup/empty/nil, `apperror.NotFound` on unknown
5. **tests** — `module_test.go`: stubCorePlugin/stubFullPlugin, 타입 assertion, registry 100%

## Verification
- `go build ./...` clean
- `go vet ./...` clean
- `go test -race ./internal/engine/...` all green (legacy tests still pass)
- 신규 파일 커버리지 ≥ 75%
- `go mod tidy` no diff

## Parallel-safety notes
- A2 가 `GameEvent` 참조 → 머지 순서 A1 → A2 강제. A2 worktree 는 임시 placeholder 허용
- A3 는 engine/ 안 건드림 → 충돌 없음
- 레거시 `engine.Module`, `engine.Register` 등 일절 건드리지 않음

## Naming note
`Plugin` 은 임시명. PR-A4 에서 레거시 삭제 후 `Module` 로 일괄 리네임.
