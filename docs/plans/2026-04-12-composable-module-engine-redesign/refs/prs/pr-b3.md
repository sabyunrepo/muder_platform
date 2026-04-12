# PR-B3 — progression + exploration + core 모듈 마이그

**Wave**: 4 · **Parallel**: ×4 · **Depends on**: A4 · **Worktree**: required

## Scope globs
- `apps/server/internal/module/progression/*.go`
- `apps/server/internal/module/progression/*_test.go`
- `apps/server/internal/module/exploration/*.go`
- `apps/server/internal/module/exploration/*_test.go`
- `apps/server/internal/module/core/*.go`
- `apps/server/internal/module/core/*_test.go`

## Context
Phase 8.0 progression (Timer, Ready, Ending), exploration (Location), core (공통 유틸) 를 새 `Module` 인터페이스로 마이그.

## Tasks

1. **Timer 마이그** — Core 7, `PhaseHookPlugin` (OnPhaseEnter 에서 타이머 시작), `GameEventHandler` (일시정지/재개)
2. **Ready 마이그** — Core 7, `GameEventHandler` (ready_up), `PhaseHookPlugin` (pre-game phase)
3. **Ending 마이그** — Core 7, `PhaseHookPlugin` (OnPhaseEnter reveal phase)
4. **Location/exploration 마이그** — Core 7, `GameEventHandler` (move, examine), `RuleProvider` (접근 가능 룰)
5. **core 공통 유틸 마이그** — 구조체/helper 만 있고 인터페이스 구현 없으면 touch 없이 namespace 만 정리
6. **tests 이관**

## Verification
- `go build ./...` clean
- `go test -race ./internal/module/{progression,exploration,core}/...` all green
- 커버리지 유지

## Parallel-safety notes
- B1/B2/B4 와 다른 디렉터리
- A7 의존성 없음 (룰 평가 안 함) — W3 결과 기다리지 않고 진행 가능 (단 W4 시작 조건이 A4 머지 후)
