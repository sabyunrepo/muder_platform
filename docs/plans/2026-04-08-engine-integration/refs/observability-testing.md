# Observability, 테스트, 에러 처리, 위험 요소

> 부모: [../design.md](../design.md)

---

## Observability

### Prometheus Metrics (9종)

```
mmp_active_sessions{theme}                   Gauge      현재 active session 수
mmp_session_duration_seconds                 Histogram  session lifetime
mmp_phase_duration_seconds{phase}             Histogram  phase 머무는 시간
mmp_module_message_total{module,type}         Counter    모듈별 메시지 처리량
mmp_module_message_duration_seconds{module}   Histogram  메시지 처리 시간
mmp_module_panic_total{module}                Counter    panic 횟수
mmp_redis_snapshot_duration_seconds           Histogram  스냅샷 write 시간
mmp_redis_snapshot_failure_total              Counter    스냅샷 실패 횟수
mmp_session_inbox_depth                       Gauge      inbox 점유율
```

### OTel Traces

- **Per-session span**: `Session.Run()` 시작 ~ 종료 (긴 root span)
- **Per-message span**: `handleMessage` child span
  - Attributes: `kind`, `playerID`, `moduleName`, `session.id`
- **Engine actions**: `engine.Start`, phase 전환, snapshot persist 각각 child span
- **Redis ops**: snapshot/restore 각각 span

### Logs (zerolog)

- 기존 `main.go`의 zerolog + OTel hook (trace_id 자동 주입) 그대로
- 추가 로그 이벤트:
  - Info: session 시작/종료
  - Error: panic + Sentry capture
  - Warn: snapshot 실패, restore 시도/실패
  - Debug: inbox depth, event publish

### 알람 (Phase 8.0 제외)

Prometheus 알람 룰은 Phase 8.0 범위 밖 (운영/SRE 영역). Phase 8.0의 책임은 "알람 걸 수 있을 만한 메트릭 기반".

---

## 테스트 전략

### Unit 테스트

| 파일 | 대상 |
|------|------|
| `internal/session/manager_test.go` | Start/Stop/Get/Restore lifecycle |
| `internal/session/session_test.go` | actor loop, 메시지 dispatch, panic recover, snapshot throttle |
| `internal/session/event_mapping_test.go` | 매핑 등록 + convert 함수 |
| `internal/ws/base_module_handler_test.go` | WithSession boilerplate (fake manager) |
| `internal/ws/hub_test.go` | RegisterLifecycleListener, notify on disconnect/rejoin |

### Integration 테스트 (in-process, fake WS)

| 파일 | 시나리오 |
|------|---------|
| `internal/integration/session_lifecycle_test.go` | Manager.Start → Session goroutine 생성 → 메시지 처리 → Stop |
| `internal/integration/reading_e2e_test.go` | 가짜 client 2개 (host + player) → reading:advance/voice_ended → broadcast 검증 |
| `internal/integration/restart_recovery_test.go` | Session 생성 → Redis 스냅샷 → Manager 재시작 → Lazy Restore → 상태 일치 |
| `internal/integration/disconnect_pause_test.go` | host disconnect → reading:paused broadcast → host reconnect → reading:resumed |
| `internal/integration/panic_isolation_test.go` | 모듈 panic 3회 누적 → session abort 검증 |

### E2E (Playwright)

**Phase 8.1로 미룸.** Phase 8.0에서는 in-process integration test만.

### 커버리지 목표

- `session` 패키지: 80%+
- 통합 시나리오: reading e2e 1개 + restart 1개 + panic 1개 (코어 path)
- Race detector (`-race`) 모든 테스트에 적용 (CI 게이트)

---

## 에러 처리

### 카테고리별 처리

| 카테고리 | 처리 |
|---------|------|
| 사용자 권한/입력 (apperror) | Reply 채널 반환 → ws.Error envelope |
| 모듈 panic | message 단위 recover, count++, 3회 시 session abort + Sentry |
| Redis 일시 장애 | 재시도 (exponential backoff, max 3) → 실패 시 Warn + Sentry. session 진행 차단 안 함 |
| EventBus subscriber 에러 | log only (broadcast 실패는 치명적 아님) |
| Inbox full | 500ms 대기 후 ws.Error (rare signal — 메시지 처리 너무 느림) |

### Apperror 매핑

`appErrorToWSCode` 함수가 이미 reading 모듈에 구현됨 (`ws/reading_handler.go`). 다른 모듈도 동일 패턴으로 확장.

---

## 위험 요소 + 완화

| 위험 | 완화 |
|------|------|
| engine.go lock 제거 후 기존 호출자가 race 만남 | PR-1에서 lock 제거 + 모든 메서드를 Session goroutine 안에서만 호출되도록 강제. `go test -race` CI gate 필수 |
| Inbox full → 메시지 손실 | Inbox buffer 256, full 시 클라에 명시 에러 + Prometheus alert. Dev에서 hit 시 즉시 조사 |
| Redis 다운 시 session 진행 | 스냅샷 실패 ≠ session 차단. Warn + Sentry, 메모리에서 계속 진행 |
| Snapshot schemaVersion 호환성 (v3.0 → v3.1) | 스냅샷에 `schemaVersion` 필드. 복구 시 mismatch면 그 session 손실 (cold start) + 운영 알람 |
| 9개 PR 머지 중 main 깨짐 | Feature flag 보호 + race detector + 통합 테스트 CI gate + wave 머지 후 user 확인 1회 |
| 12 모듈 wiring 중 일관성 어긋남 | PR-4에서 패턴 확정 후 `module-wiring-guide.md` 작성. PR-5, PR-6은 mechanical copy |
| Phase 8.0.x 후속이 패턴 누락 | Phase 8.0 종료 시 가이드 문서 commit (`refs/module-wiring-guide.md`) |
| Wave 4 병렬 머지 충돌 | 파일 구조 설계 시 모듈별 파일 분리 (`refs/execution-model.md` 참조). main.go는 PR-3 이후 수정 금지 |
| Worktree 디스크 비용 | 병렬 wave에서 4배 repo 복사. 이 프로젝트는 크지 않아 무시 가능 |

---

## 관측성 + 테스트의 도입 시점 (PR 매핑)

| PR | Observability 추가 | Test 추가 |
|----|---------------------|-----------|
| PR-1 | 기본 로그 | session_test.go 기초 |
| PR-2 | — | hub_test.go 갱신 |
| PR-3 | — | base_module_handler_test.go, event_mapping_test.go |
| PR-4 | — | reading_e2e_test.go |
| PR-5 | — | core 모듈 smoke test |
| PR-6 | — | progression smoke + session_lifecycle_test.go |
| PR-7 | `mmp_redis_snapshot_*` 메트릭 | restart_recovery_test.go |
| PR-8 | — | api test (start, abort) |
| PR-9 | **나머지 8종 메트릭 전부 + OTel spans** | panic_isolation_test.go + metric scrape test |

PR-9가 observability 전담. 나머지 PR은 로컬 로그만.
