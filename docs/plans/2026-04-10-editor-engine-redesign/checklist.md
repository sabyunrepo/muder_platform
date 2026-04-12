<!-- STATUS-START -->
**Active**: Phase 9.0 — Editor + Engine Redesign — Phase A (engine-core)
**PR**: PR-A1 (GenrePlugin Core + Registry)
**Task**: GenrePlugin Core + Optional interfaces + Registry
**State**: pending
**Blockers**: none
**Last updated**: 2026-04-10
<!-- STATUS-END -->

# Phase 9.0 — Editor + Engine Redesign 체크리스트

> 부모: [design.md](design.md) | 실행: [plan.md](plan.md)
> 선행: Phase 8.0 (superseded, PR-1/PR-2 재사용)

---

## Phase A — 엔진 코어 (7 PRs)

> 상세: [refs/phase-a-engine-core.md](refs/phase-a-engine-core.md)

### Wave 1 — 기본 인터페이스 (parallel ×3)

#### PR-A1: GenrePlugin Core + Optional + Registry
- [x] `engine/module_types.go` — GameEvent, GameState, Phase, PhaseDefinition, WinResult, Rule
- [x] `engine/module.go` — Plugin Core interface (7 methods) + PluginConfigSchema
- [x] `engine/module_optional.go` — GameEventHandler, WinChecker, PhaseHookPlugin, SerializablePlugin, RuleProvider
- [x] `engine/module_registry.go` — NewPluginRegistry(), Register(), New(), List()
- [x] `engine/module_test.go` — stubCorePlugin, stubFullPlugin, type assertion + registry coverage (100% new files)
- [ ] `genre/shared/connection.go` — 공통 접속 로직 (PR-B1로 이동)
- [ ] Phase 8.0 Migration: legacy types.go/engine.go 제거 (PR-A4로 이동)

#### PR-A2: EventBus (EventListener)
- [ ] `engine/event_bus.go` — EventListener interface, Subscribe, Publish (에러 수집)
- [ ] `engine/event_bus_test.go` — error isolation, 동시 구독, 성능
- [ ] Phase 8.0 Migration: 기존 EventBus callback → EventListener 인터페이스 전환

#### PR-A3: Audit Log (PG)
- [ ] `auditlog/writer.go` — 비동기 PG writer (INSERT only)
- [ ] `auditlog/snapshot.go` — Redis → PG 스냅샷 (5s 간격 + critical 즉시)
- [ ] `auditlog/event_types.go` — 이벤트 타입 정의
- [ ] DB migration: game_audit_log, game_snapshots 테이블
- [ ] `auditlog/writer_test.go`, `auditlog/snapshot_test.go`

### Wave 1 gate
- [ ] 3 PR scope 겹침 검증
- [ ] `go test -race ./internal/engine/... ./internal/auditlog/...` pass
- [ ] User 확인 → Wave 2

### Wave 2 — PhaseEngine + Processor (sequential)

#### PR-A4: PhaseEngine (stateless wrapper)
- [ ] `engine/phase_engine.go` — fsmAdapter interface + qmuntal/stateless wrapper
- [ ] `engine/phase_engine_test.go` — wrapper 격리 (stateless 교체 가능성 검증)
- [ ] Phase 8.0 Migration: ProgressionStrategy 제거, PhaseEngine으로 대체

#### PR-A5: EventProcessor chain
- [ ] `engine/processor_chain.go` — EventProcessor interface + SetNext
- [ ] `engine/validator.go` — AuthValidator, SessionValidator, PhaseValidator, GenreValidator
- [ ] `engine/genre_processor.go` — Plugin type assertion으로 Validate/Apply 분기
- [ ] `engine/win_checker.go` — Plugin type assertion으로 CheckWin 분기
- [ ] `engine/post_processor.go` — 사이드 이펙트 (Hub.Broadcast, Snapshot trigger)
- [ ] `engine/processor_chain_test.go` — 체인 구성 + 순차 처리 검증

### Wave 2 gate
- [ ] A4+A5 `go test -race` pass
- [ ] PhaseEngine wrapper 교체 테스트 pass
- [ ] User 확인 → Wave 3

### Wave 3 — Clue + Rules (parallel ×2)

#### PR-A6: Clue System
- [ ] `clue/graph.go` — ClueGraph (인접 리스트), TopologicalSort, DetectCycles, FindCombination
- [ ] `clue/validator.go` — ClueValidator (체인: prerequisite, combination, location, role, condition)
- [ ] `clue/visibility.go` — VisibilitySpec (Specification: And, Or, Not combinators)
- [ ] `clue/types.go` — ClueType, ClueDistribution, ClueVisibility, ClueInteraction, ClueEffect, LocationRestriction
- [ ] `clue/graph_test.go`, `clue/validator_test.go`, `clue/visibility_test.go`

#### PR-A7: Rule Evaluator
- [ ] `engine/rule_evaluator.go` — diegoholiveira/jsonlogic wrapper
- [ ] `engine/rule_evaluator_test.go` — 크로스 엔진 패리티 (100+ 식)

### Phase A gate
- [ ] 모든 7 PR merge
- [ ] `go test -race ./...` pass (engine, auditlog, clue)
- [ ] JSON Logic 크로스 엔진 패리티 테스트 pass
- [ ] User 확인 → Phase B

---

## Phase B — Murder Mystery 장르 (5 PRs, 순차)

> 상세: [refs/phase-b-murder-mystery.md](refs/phase-b-murder-mystery.md)

- [ ] B1: MurderMysteryPlugin 골격 + ConfigSchema
- [ ] B2: StartingClue + RoundClue 배포
- [ ] B3: ConditionalClue (선행 조건 + 연쇄)
- [ ] B4: Voting + Accusation 통합
- [ ] B5: PhaseHooks + CheckWin + 직렬화 + E2E
- [ ] Phase B gate: E2E "6인, 3라운드, 범인 지목" 시나리오 PASS

---

## Phase C — 에디터 Layer 1 (7 PRs) — MVP

> 상세: [refs/phase-c-editor-l1.md](refs/phase-c-editor-l1.md)

- [ ] C1: 3-column EditorLayout + UIStore
- [ ] C2: GenreSelector + 프리셋 로드
- [ ] C3: SchemaDrivenForm (react-hook-form + zod)
- [ ] C4: 캐릭터 CRUD
- [ ] C5: 단서 리스트 + 그래프 뷰
- [ ] C6: 자동저장 + 유효성 검사
- [ ] C7: 장르 프리셋 API (백엔드)
- [ ] Phase C gate: 에디터로 테마 생성 → 게임 시작 E2E PASS

---

## Phase D — 에디터 Layer 2 (7 PRs)

> 상세: [refs/phase-d-editor-l2.md](refs/phase-d-editor-l2.md)

- [ ] D1: React Flow 캔버스
- [ ] D2: PhaseNode/StartNode/EndNode
- [ ] D3: Timeline View
- [ ] D4: Module Palette
- [ ] D5: Phase Config Panel
- [ ] D6: JSON Logic 규칙 에디터
- [ ] D7: Phase Template CRUD API

---

## Phase E — 에디터 Layer 3 (4 PRs) — stretch

> 상세: [refs/phase-e-editor-l3.md](refs/phase-e-editor-l3.md)

- [ ] E1: ConditionNode + ActionNode + EventTriggerNode
- [ ] E2: 단서 의존성 그래프 + ClueComboNode
- [ ] E3: dagre 자동 배치 + 시뮬레이션
- [ ] E4: 언두/리도

---

## Phase F — Crime Scene 장르 (4 PRs)

> 상세: [refs/phase-f-crime-scene.md](refs/phase-f-crime-scene.md)

- [ ] F1: CrimeScenePlugin (장소 탐색 + 증거 조합)
- [ ] F2: LocationRestriction + VisibilitySpec
- [ ] F3: CrimeSceneView 프론트엔드
- [ ] F4: 아키텍처 검증 (공통 코드 비율 60%+)

---

## Phase G — 추가 장르 (5 PRs)

> 상세: [refs/phase-g-additional.md](refs/phase-g-additional.md)

- [ ] G1: ScriptKillPlugin
- [ ] G2: JubenshaPlugin
- [ ] G3: ScriptKillView + JubenshaView
- [ ] G4: 장르별 프리셋
- [ ] G5: 크로스 장르 통합 테스트

---

## Phase 9.0 완료 gate

- [ ] Phase A~G 모든 PR merge
- [ ] 4 장르 E2E 테스트 PASS
- [ ] 에디터에서 4장르 테마 생성 → 게임 시작 가능
- [ ] 공통 코드 비율 55%+ (F4/G5 측정)
- [ ] JSON Logic 크로스 엔진 패리티 테스트 PASS
- [ ] `feature flag flip` → dev `MMP_EDITOR_ENGINE_V2=true`
- [ ] `/plan-finish` → archive
