# PR-A7 — JSON Logic Rule Evaluator

**Wave**: 3 · **Sequential** · **Depends on**: A6 · **Worktree**: optional

## Scope globs
- `apps/server/internal/engine/rule_evaluator.go` (new)
- `apps/server/internal/engine/rule_evaluator_test.go` (new)
- `apps/server/internal/engine/rule_evaluator_parity_test.go` (new)

## Context
JSON Logic 표현식 평가기. `RuleProvider.GetRules()` 가 반환한 룰을 game state 컨텍스트에서 평가.
프론트 (TS) JSON Logic 엔진과 **패리티** 유지 — 같은 입력 → 같은 결과.

## Tasks

1. **eval core** — JSON Logic 연산자 (`if`, `==`, `!=`, `<`, `>`, `and`, `or`, `not`, `var`, `in`, `map`, `filter`, `reduce`)
2. **context** — game state variable resolution (`var: "players.alice.role"`)
3. **cache** — parsed expression cache (session 수명)
4. **parity test** — 프론트 json-logic-js 와 같은 결과 검증 (golden JSON fixtures)
5. **tests** — 단위 + 엣지 케이스 (null, missing var, deep nest)

## Verification
- `go build ./...` clean
- `go test -race ./internal/engine/...` all green
- 커버리지 ≥ 85%
- Parity test 100% pass (프론트 fixture 공유)

## Library 선택
- 옵션 1: `github.com/diegoholiveira/jsonlogic/v3` (community, maintained)
- 옵션 2: 자체 구현 (정확한 파리티 보장)
- **결정**: 옵션 1 시도 후 파리티 fail 시 옵션 2 fallback

## Notes
- A7 은 B1/B2 가 `RuleProvider` 구현 시 import
- A6 의 `clue.Graph` 를 context 에 주입해서 룰에서 단서 상태 참조 가능하게
