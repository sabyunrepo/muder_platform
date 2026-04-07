# PR-9: Observability (Prometheus + OTel)

> Wave 5 (sequential) | 의존: PR-5, PR-6, PR-7, PR-8

## 목적
Phase 8.0 전체에 메트릭 + 트레이스 + 로그 주입. 운영 알람 기반 제공 (알람 룰 자체는 Phase 8.0 범위 밖).

## Tasks
- [ ] `internal/session/metrics.go` — Prometheus collectors 9종 정의
  - `mmp_active_sessions{theme}` (Gauge)
  - `mmp_session_duration_seconds` (Histogram)
  - `mmp_phase_duration_seconds{phase}` (Histogram)
  - `mmp_module_message_total{module,type}` (Counter)
  - `mmp_module_message_duration_seconds{module}` (Histogram)
  - `mmp_module_panic_total{module}` (Counter)
  - `mmp_redis_snapshot_duration_seconds` (Histogram)
  - `mmp_redis_snapshot_failure_total` (Counter)
  - `mmp_session_inbox_depth` (Gauge)
- [ ] `internal/session/tracing.go` — OTel span helpers (sessionSpan, messageSpan, engineSpan)
- [ ] Per-session root span: Session.Run() 시작~종료
- [ ] Per-message child span: handleMessage (kind/playerID/moduleName 속성)
- [ ] Engine action spans: Start, phase 전환, snapshot persist 각각
- [ ] Redis op spans: snapshot/restore
- [ ] Log enrichment: 기존 zerolog + trace_id 자동 주입 (이미 main.go hook)
- [ ] `internal/session/metrics_test.go` — metric scrape test (promtest 사용)
- [ ] `internal/integration/observability_e2e_test.go` — 세션 생성/메시지/종료 후 /metrics 엔드포인트에 9종 모두 노출 확인
- [ ] `docs/plans/2026-04-08-engine-integration/refs/observability-testing.md` 업데이트 (구현 위치 반영)
- [ ] **feature flag 활성화 결정**: 이 PR 머지 후 user 확인 거쳐 dev에서 `MMP_ENGINE_WIRING_ENABLED=true` flip
- [ ] 최종 smoke test: 12개 모듈 smoke + reading e2e + restart recovery + panic isolation 모두 pass

## Files 추가
- `internal/session/metrics.go`
- `internal/session/tracing.go`
- `internal/session/metrics_test.go`
- `internal/integration/observability_e2e_test.go`

## Files 수정 (메트릭/트레이스 주입, 기존 PR 결과물에)
- `internal/session/manager.go` (active_sessions gauge)
- `internal/session/session.go` (message counter, panic counter, inbox depth)
- `internal/session/snapshot.go` (snapshot duration + failure)
- `internal/engine/engine.go` (phase_duration, start span)
- `internal/ws/handlers/*.go` (message counter)

## Test coverage
- metrics_test: 각 collector 등록 + Increment/Observe 동작
- observability_e2e_test: 실제 세션 생성 → /metrics scrape → 9종 모두 존재

## Definition of done
- 모든 metric 9종 `/metrics` endpoint에서 scrape 가능
- Per-session trace가 Jaeger/Tempo에서 조회 가능 (dev)
- zerolog 로그에 trace_id 주입 확인
- **모든 Phase 8.0 종료 조건 체크리스트 완료** (design.md의 종료 조건 섹션)
- 최종 PR 브랜치: `feat/phase-8.0/pr-9-observability`

## Review focus
- Security: metric label cardinality 폭발 방지 (theme, phase만 라벨로)
- Performance: OTel span 오버헤드 < 5% (sample rate 0.1 적정)
- Architecture: metric 주입이 침투적이지 않게 (wrapper 최소화)
- Test coverage: metric scrape test, trace export 검증

## Phase 완료 체크리스트 (이 PR 머지 후)
- [ ] 9 PR 모두 main 머지
- [ ] feature flag 활성 상태에서 통합 테스트 PASS
- [ ] 12 모듈 smoke test PASS
- [ ] e2e 한 게임 시나리오 통과
- [ ] restart 복구 + panic 격리 시나리오 통과
- [ ] Prometheus metric 9종 scrape 가능
- [ ] `project_phase80_progress.md` 최종 갱신
- [ ] 루트 checklist "Phase 8.0 ✅"
- [ ] `/plan-finish` 실행 → archived_plans/ 이동
- [ ] Phase 8.0.x follow-up plan 결정 (17 모듈 wiring)
