# PR-B2 — decision 모듈 마이그

**Wave**: 4 · **Parallel**: ×4 · **Depends on**: A4, A7 · **Worktree**: required

## Scope globs
- `apps/server/internal/module/decision/*.go`
- `apps/server/internal/module/decision/*_test.go`

## Context
Phase 8.0 decision 모듈 (Voting, Accusation, HiddenMission) 을 새 `Module` 인터페이스로 마이그.

## Tasks

1. **Voting 마이그** — Core 7, `GameEventHandler` (cast_vote/change_vote), `WinChecker` (optional, 투표 기반 승리), `SerializablePlugin` (투표 상태), `RuleProvider` (집계 룰 — plurality/majority/ranked)
2. **Accusation 마이그** — Core 7, `GameEventHandler` (accuse), `WinChecker` (정답 일치), `PhaseHookPlugin` (accusation phase 해금)
3. **HiddenMission 마이그** — Core 7, `SerializablePlugin` (플레이어별 미션 상태), `WinChecker` (미션 완수 기반 추가 승리), `RuleProvider` (미션 조건)
4. **tests 이관**

## Verification
- `go build ./...` clean
- `go test -race ./internal/module/decision/...` all green
- 커버리지 유지 또는 향상

## Parallel-safety notes
- B1/B3/B4 와 다른 디렉터리 — 충돌 없음
- A7 의 JSON Logic evaluator 를 실제 사용하는 첫 모듈 그룹 — parity 검증 가치 있음
