# PR-A3 — Audit Log Package

**Wave**: 1 · **Parallel**: ×3 · **Depends on**: none · **Worktree**: required

## Scope globs
- `apps/server/internal/auditlog/event.go` (new)
- `apps/server/internal/auditlog/logger.go` (new)
- `apps/server/internal/auditlog/store.go` (new)
- `apps/server/internal/auditlog/logger_test.go` (new)
- `apps/server/internal/auditlog/store_test.go` (new)
- `apps/server/internal/db/migrations/NNNN_audit_events.up.sql` (new)
- `apps/server/internal/db/migrations/NNNN_audit_events.down.sql` (new)
- `apps/server/internal/db/queries/audit_events.sql` (new)

## Context
게임 내 의사결정을 영구 기록. zerolog 와 별도 — 분쟁 해결/replay/통계 용도.
append-only, 세션별 seq 순서 보존.

## Tasks

1. **migration** — `audit_events` 테이블 (session_id, seq, actor_id, action, module_id, payload, created_at + UNIQUE(session_id, seq))
2. **sqlc queries** — `AppendAuditEvent`, `ListBySession`, `LatestSeq`
3. **event** — `AuditEvent` struct, `AuditAction` enum (player_action/phase_enter/phase_exit/win_decision/module_panic/rule_eval)
4. **logger** — `Logger` interface + `DBLogger` impl (buffered append with flush), `NoOpLogger` for tests
5. **store** — `Store` wrapping sqlc, thread-safe seq increment
6. **tests** — unit (NoOpLogger) + integration (testcontainers PostgreSQL)

## Verification
- `go build ./...` clean
- `go test -race ./internal/auditlog/...` all green
- 신규 파일 커버리지 ≥ 80%
- sqlc generate 클린
- Migration up/down 양방향 실행 가능

## Parallel-safety notes
- engine/ 안 건드림 → A1/A2 와 충돌 없음
- 자체 신규 패키지 — soft dependency 없음
