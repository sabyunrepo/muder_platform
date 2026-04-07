<!-- STATUS-START -->
**Active**: Phase 8.0 — Engine Integration Layer — Wave 2/5 (infra)
**PR**: PR-3 (BaseModuleHandler + EventMapping)
**Task**: PR-3 sequential execution (BaseModuleHandler infra + Manager DI)
**State**: pending
**Blockers**: none
**Last updated**: 2026-04-08
<!-- STATUS-END -->

# Phase 8.0 — Engine Integration Layer 체크리스트

> 부모: [design.md](design.md) | 실행: [plan.md](plan.md)

이 파일은 진행 상태 tracking. STATUS 마커는 hook/스크립트가 파싱하므로 형식 유지.
PR별 상세 task 정의는 `refs/pr-N-*.md` (이 파일은 요약 + 진행 체크).

---

## Wave 0 — 문서 + 인프라 ✅

- [x] design.md refactor to index + refs (각 <200줄)
- [x] memory files wave 정보 반영
- [x] plan-autopilot 스킬 생성 + 프로젝트 설치
- [x] .claude/active-plan.json 초기화
- [x] plan.md + refs/pr-0~9-*.md 작성
- [x] 루트 checklist.md Phase 8.0 추가 + Phase 8 → 8.1 rename
- [x] CLAUDE.md "Active Plan Workflow" 섹션 추가
- [x] PR-0 commit (PR #11 + #12 + #13)

---

## Wave 1 — Skeletons (parallel ×2) ✅

### PR-1: SessionManager + Session actor — PR #17 (merged 74129fc)
- [x] `internal/session/types.go` (SessionMessage / MessageKind / SessionStatus / TriggerPayload / GMOverridePayload)
- [x] `internal/session/manager.go` (Start/Stop/Get/Restore stub + onAbort wired + Stop waits goroutine)
- [x] `internal/session/session.go` (Run loop + handleMessage + non-blocking reply + ctx.Done close)
- [x] `internal/session/panic_guard.go` (3회 누적 abort + panic_type + debug.Stack)
- [x] `internal/engine/engine.go` lock 제거 (sync.RWMutex 삭제)
- [x] `internal/session/{manager,session,panic,main}_test.go` + goleak + `-race -count=10`
- 후속: Manager.Stop(ctx, reason) 시그니처 → PR-3 DI 시점에 처리

### PR-2: Hub lifecycle listener — PR #16 (merged daa56b8)
- [x] `internal/ws/lifecycle.go` (SessionLifecycleListener interface)
- [x] `internal/ws/hub.go` (RegisterLifecycleListener + notify on un/register + LeaveSession graceful + gcAllRecentLeft sweeper)
- [x] reconnect 감지 로직 (JoinSession 경로 + 30s window + slice deep-copy + defer recover)
- [x] `internal/ws/{hub,hub_lifecycle}_test.go` + `-race -count=10`

### Wave 1 gate ✅
- [x] PR-1, PR-2 모든 task ✅
- [x] 4-reviewer 병렬 리뷰 pass / fix-loop iteration 1 (8 HIGH/MEDIUM 해결)
- [x] `go test -race ./internal/{session,engine,ws}/...` pass
- [x] PR-1 → PR-2 순차 merge to main
- [x] User 확인 → Wave 2 진입

---

## Wave 2 — 인프라 (sequential)

### PR-3: BaseModuleHandler + EventMapping infra — refs/pr-3-base-handler.md
- [ ] `internal/ws/base_module_handler.go` (WithSession 헬퍼 + 2s reply timeout)
- [ ] `internal/session/event_mapping.go` (EventMapping 구조 + subscribe)
- [ ] `internal/session/registry.go` (RegisterAllHandlers 팩토리)
- [ ] `internal/session/manager.go` SessionLifecycleListener 구현
- [ ] `cmd/server/main.go` 최소 수정 (manager DI + RegisterAllHandlers)
- [ ] feature flag `MMP_ENGINE_WIRING_ENABLED` (default false → no-op stub)
- [ ] base_module / event_mapping / lifecycle test (race)

**Wave 2 gate**: 위와 동일 패턴. **이 PR 머지 후 main.go 수정 금지**.

---

## Wave 3 — 패턴 레퍼런스 (sequential)

### PR-4: Reading 모듈 wired — refs/pr-4-reading-wired.md
- [ ] `internal/ws/handlers/reading.go` (기존 reading_handler.go 이동)
- [ ] `internal/session/registry_reading.go`
- [ ] `internal/session/event_mapping_reading.go` (camelCase 변환 포함)
- [ ] `internal/session/registry.go` 호출 1줄 추가
- [ ] PhaseAction `start_reading_section` → ReadingModule.Init 경로
- [ ] integration: reading e2e / disconnect / snapshot 3 test
- [ ] `refs/module-wiring-guide.md` 생성 (PR-5/6용 template)

**Wave 3 gate**: 이 PR이 후속 모든 모듈 wiring의 패턴 확정.

---

## Wave 4 — 병렬 wiring (parallel ×4)

### PR-5: Core 4 modules — refs/pr-5-core-modules.md
- [ ] `internal/ws/handlers/core_{connection,room,ready,clue_interaction}.go`
- [ ] `internal/session/registry_core.go` + `event_mapping_core.go`
- [ ] `internal/session/registry.go` 1줄 추가
- [ ] `internal/ws/error_code.go` Core 매핑
- [ ] 4 smoke test + integration

### PR-6: Progression 7 modules — refs/pr-6-progression-modules.md
- [ ] `internal/ws/handlers/progression_{script,hybrid,event,skip_consensus,gm_control,consensus_control,ending}.go`
- [ ] `internal/session/registry_progression.go` + `event_mapping_progression.go`
- [ ] `internal/session/registry.go` 1줄 추가
- [ ] strategy 3종 e2e + ending + consensus test

### PR-7: Redis snapshot + Lazy restore — refs/pr-7-snapshot-restore.md
- [ ] `internal/session/{snapshot,restore}.go` (5s throttle + critical 즉시 + markDirty)
- [ ] `internal/session/session.go` 확장 (snapshot ticker)
- [ ] `internal/session/manager.go` Restore lazy
- [ ] `internal/engine/engine.go` RestoreEngineState/RestoreModuleState
- [ ] `internal/engine/types.go` Module.RestoreState 인터페이스
- [ ] `internal/module/progression/reading.go` RestoreState 구현
- [ ] schemaVersion v3.0 + mismatch 손실 처리
- [ ] integration: restart_recovery / snapshot_throttle

### PR-8: Game start API + abort + idle timeout — refs/pr-8-game-start-api.md
- [ ] `internal/domain/room/{handler_game,service_game}.go` (host 검증, ready, ValidateConfig)
- [ ] `POST /api/v1/rooms/{id}/{start,abort}` 라우트
- [ ] `internal/session/session.go` idle timeout 1분 ticker (10분 + all disconnected → abort)
- [ ] `cmd/server/main.go` 라우트 등록 (예외 허용)
- [ ] Room.sessionID 필드 + DB migration
- [ ] handler unit test + game_start / idle_timeout integration

### Wave 4 gate
- [ ] 4 PR scope 겹침 검증 (`plan-wave.sh validate W4`)
- [ ] 순차 머지 + 머지 사이 `go test -race ./...`
- [ ] User 확인 → Wave 5

---

## Wave 5 — Observability (sequential)

### PR-9: Prometheus + OTel — refs/pr-9-observability.md
- [ ] `internal/session/metrics.go` (9 collectors)
- [ ] `internal/session/tracing.go` (session/message/engine span)
- [ ] manager/session/snapshot/engine/handlers 메트릭+스팬 주입
- [ ] zerolog trace_id 주입 확인
- [ ] metrics_test + observability_e2e_test (9종 scrape)
- [ ] `refs/observability-testing.md` 구현 위치 반영
- [ ] **feature flag flip 결정** (user 확인) → dev `MMP_ENGINE_WIRING_ENABLED=true`
- [ ] 12 모듈 smoke + reading e2e + restart recovery + panic isolation 최종 검증

**Wave 5 gate**: metric scrape test + 종료 전 최종 검증

---

## Phase completion gate

- [ ] 모든 5 waves ✅
- [ ] Feature flag 활성 상태에서 통합 테스트 PASS
- [ ] 12개 모듈 smoke test PASS
- [ ] e2e 시나리오 통과
- [ ] Restart recovery + panic isolation 시나리오 통과
- [ ] Prometheus metric 9종 scrape 가능
- [ ] `project_phase80_progress.md` 최종 갱신
- [ ] 루트 `docs/plans/2026-04-05-rebuild/checklist.md` "Phase 8.0 ✅"
- [ ] `/plan-finish` 실행 → archive
- [ ] Phase 8.0.x 후속 plan 작성 여부 결정 (17 모듈 wiring)
