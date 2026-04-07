# PR-7: Redis snapshot + Lazy restore

> Wave 4 (parallel with PR-5, PR-6, PR-8) | 의존: PR-4

## 목적
5초 throttle + critical 즉시 write snapshot → Redis. Lazy restore 구현 (첫 client reconnect 시점).

## Tasks
- [ ] `internal/session/snapshot.go` — persistSnapshot(force), maybeSnapshot (throttle), markDirty
- [ ] `internal/session/restore.go` — RestoreFromRedis (lazy), loadSnapshot
- [ ] `internal/session/session.go` 확장 — snapshot ticker (5s) 추가, dirty 마킹 훅
- [ ] `internal/session/manager.go` 확장 — Restore() 구현 (lazy)
- [ ] `internal/engine/engine.go` 확장 — RestoreEngineState / RestoreModuleState 메서드
- [ ] `internal/engine/types.go` — Module 인터페이스에 RestoreState(json.RawMessage) error 추가 (옵셔널, default no-op)
- [ ] `internal/module/progression/reading.go` — RestoreState 구현 (다른 모듈은 후속 PR에서)
- [ ] Redis key 구조: `session:{sid}:{meta,engine,module:NAME}`, TTL 24h
- [ ] schemaVersion 필드 추가 (v3.0) + 불일치 시 손실 처리 + Sentry 알림
- [ ] `internal/session/registry_snapshot.go` — snapshot ticker 등록 (registry에서 호출)
- [ ] critical 이벤트 hooks: phase 전환, 모듈 init/cleanup, ending 활성 → self inbox에 KindCriticalSnapshot self-send
- [ ] `internal/integration/restart_recovery_test.go` — Session 생성 → snapshot → Manager 재시작 → Lazy restore → 상태 일치
- [ ] `internal/integration/snapshot_throttle_test.go` — 5초 throttle 동작 검증, critical 즉시 write 검증
- [ ] `internal/session/snapshot_test.go` — unit: Redis mock으로 persist/restore

## Files 추가
- `internal/session/{snapshot,restore,snapshot_test}.go`
- `internal/session/registry_snapshot.go`
- `internal/integration/restart_recovery_test.go`
- `internal/integration/snapshot_throttle_test.go`

## Files 수정
- `internal/session/session.go` (ticker + dirty flag)
- `internal/session/manager.go` (Restore 구현)
- `internal/engine/engine.go` (RestoreEngineState/RestoreModuleState)
- `internal/engine/types.go` (Module 인터페이스 확장)
- `internal/module/progression/reading.go` (RestoreState impl)

## Test coverage
- snapshot_test: mock Redis → persistSnapshot → key 존재 확인
- throttle_test: 5초 내 여러 markDirty → write 1회만, 5초 경과 후 write, critical 즉시
- restart_recovery_test: 전체 session 직렬화 → 복원 → state 일치

## Definition of done
- 위 모든 test pass
- Redis key 구조 문서화 (design refs/persistence.md 확인)
- schemaVersion mismatch 처리 검증
- `go test -race ./internal/integration/restart_recovery_test ./internal/session/...` 안정
- PR 브랜치: `feat/phase-8.0/pr-7-snapshot-restore`

## Review focus
- Security: Redis key 포맷 검증 (path traversal 방어 불필요, sessionID는 UUID)
- Performance: Redis pipeline 사용, JSON marshaling 비용, TTL refresh 빈도
- Architecture: throttle + critical 혼재 패턴, 모듈 BuildState/RestoreState 1:1 대응
- Test coverage: Redis 장애 시나리오, 부분 복원 실패, schemaVersion mismatch

## 주의
- `internal/session/session.go` 수정이 PR-1과 영역 겹칠 수 있으나, PR-1은 skeleton이고 PR-7은 snapshot-specific 필드 추가 → merge 가능 (다른 메서드)
- `internal/engine/engine.go` 수정은 PR-1에서 lock 제거한 부분과 다름 → 경계 주의
