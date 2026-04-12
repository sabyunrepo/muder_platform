# PR-B4 — media + communication 모듈 마이그

**Wave**: 4 · **Parallel**: ×4 · **Depends on**: A4 · **Worktree**: required

## Scope globs
- `apps/server/internal/module/media/*.go`
- `apps/server/internal/module/media/*_test.go`
- `apps/server/internal/module/communication/*.go`
- `apps/server/internal/module/communication/*_test.go`

## Context
Phase 8.0 media (MediaPlayback, BGM), communication (TextChat, GroupChat, Whisper) 를 새 `Module` 인터페이스로 마이그.

## Tasks

1. **MediaPlayback 마이그** — Core 7, `PhaseHookPlugin` (OnPhaseEnter 에서 자동 재생), `GameEventHandler` (재생 제어)
2. **BGM 마이그** — Core 7, `PhaseHookPlugin` (phase별 BGM 전환)
3. **TextChat 마이그** — Core 7, `GameEventHandler` (message 전송), `RuleProvider` (채팅 허용 조건)
4. **GroupChat 마이그** — Core 7, `GameEventHandler` (그룹 생성/초대), `SerializablePlugin` (그룹 상태)
5. **Whisper 마이그** — Core 7, `GameEventHandler` (1:1 밀담), `PhaseHookPlugin` (특정 phase 에서만 해금)
6. **tests 이관**

## Verification
- `go build ./...` clean
- `go test -race ./internal/module/{media,communication}/...` all green
- 커버리지 유지

## Parallel-safety notes
- B1/B2/B3 와 다른 디렉터리
- A7 의존성 없음
