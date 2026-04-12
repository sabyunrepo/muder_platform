# PR-A6 — Clue Graph Primitive

**Wave**: 3 · **Sequential** · **Depends on**: A4 · **Worktree**: optional

## Scope globs
- `apps/server/internal/clue/graph.go` (new)
- `apps/server/internal/clue/validator.go` (new)
- `apps/server/internal/clue/visibility.go` (new)
- `apps/server/internal/clue/graph_test.go` (new)
- `apps/server/internal/clue/validator_test.go` (new)
- `apps/server/internal/clue/visibility_test.go` (new)

## Context
모든 장르가 공유하는 단서/증거 그래프 primitive. cluedist/decision/crime_scene 모듈이 라이브러리로 사용.

## Tasks

1. **types** — `Clue` struct, `ClueID`, `Dependency` (AND/OR), `Visibility` rules
2. **graph** — `Graph` struct, `Add`, `AddDependency`, `Resolve(discovered set) []Clue`, DAG 검증 (cycle detect)
3. **validator** — graph 무결성 (orphan, cycle, unreachable)
4. **visibility** — 플레이어별 단서 가시성 계산 (role/team/manual override)
5. **tests** — cycle detect, resolve 시나리오, visibility 매트릭스

## Verification
- `go build ./...` clean
- `go test -race ./internal/clue/...` all green
- 커버리지 ≥ 85%

## Notes
- A6 은 A4 의 engine 재배선 완료 후 시작 — W3 순차
- A7 이 Graph 위에서 JSON Logic 룰 평가하므로 API 안정성 중요
