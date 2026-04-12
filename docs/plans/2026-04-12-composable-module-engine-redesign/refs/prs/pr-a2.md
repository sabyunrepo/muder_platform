# PR-A2 — EventBus Rewrite (Typed pub/sub)

**Wave**: 1 · **Parallel**: ×3 · **Depends on**: none (soft: A1 GameEvent) · **Worktree**: required

## Scope globs
- `apps/server/internal/engine/event_bus.go` (new)
- `apps/server/internal/engine/event_bus_test.go` (new)

## Context
레거시 `internal/eventbus/**` 는 callback 기반. 신규 `engine/event_bus.go` 는 typed pub/sub (subscriber interface).
레거시 파일은 PR-A2 에서 건드리지 않음 (A4 에서 통째 삭제).

## Tasks

1. **interface** — `Subscriber`, `Publisher` interface 정의
2. **impl** — `EventBus` struct, `Subscribe(topic, Subscriber)`, `Publish(event GameEvent)`, thread-safe (RWMutex)
3. **tests** — race tests, subscribe/unsubscribe lifecycle, panic in subscriber isolation

## Verification
- `go build ./...` clean
- `go test -race ./internal/engine/...` all green
- 신규 파일 커버리지 ≥ 80%
- 레거시 `internal/eventbus/**` 빌드/테스트 불변

## Parallel-safety notes
- `GameEvent` 타입은 A1 소유 — A1 머지 후 rebase 필수
- A1 머지 전에 작업 시작 가능: 임시로 로컬 type alias 선언 후 rebase 때 교체
- A3 와 충돌 없음
