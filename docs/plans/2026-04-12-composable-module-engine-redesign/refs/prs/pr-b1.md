# PR-B1 — cluedist 모듈 마이그

**Wave**: 4 · **Parallel**: ×4 · **Depends on**: A4, A7 · **Worktree**: required

## Scope globs
- `apps/server/internal/module/cluedist/*.go`
- `apps/server/internal/module/cluedist/*_test.go`

## Context
Phase 8.0 cluedist 모듈 (StartingClue, RoundClue, ConditionalClue) 을 새 `Module` 인터페이스로 마이그. 로직 변경 없음 — 인터페이스 리파인먼트만.

## Tasks

1. **StartingClue 마이그** — Core 7 구현, `PhaseHookPlugin` opt-in (OnPhaseEnter 에서 배포), `SerializablePlugin` opt-in
2. **RoundClue 마이그** — Core 7, `PhaseHookPlugin` (라운드 진입), `GameEventHandler` (플레이어 요청), `SerializablePlugin`, `RuleProvider` (조건부 공개 룰)
3. **ConditionalClue 마이그** — Core 7, `RuleProvider` (공개 조건), `GameEventHandler` (이벤트 기반 해금)
4. **tests 이관** — 기존 테스트 유지, Factory 패턴 맞춰 수정

## Verification
- `go build ./...` clean
- `go test -race ./internal/module/cluedist/...` all green
- 커버리지 유지 또는 향상 (Phase 8.0 baseline 이상)
- 다른 모듈 테스트 영향 없음 (`go test ./internal/module/...`)

## Parallel-safety notes
- B2/B3/B4 와 완전히 다른 디렉터리 — 충돌 없음
- A4 머지 후 시작 — 새 `engine.Module` 인터페이스 사용
- A7 머지 후 시작 — `RuleProvider` 반환 룰이 evaluator 로 실제 평가되는지 통합 테스트
