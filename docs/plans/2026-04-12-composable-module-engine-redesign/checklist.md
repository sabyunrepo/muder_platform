<!-- STATUS-START -->
**Active**: Phase 9.0 — Composable Module Engine Redesign
**Wave**: W4
**PR**: PR-B4 (media + communication Module Migration)
**Task**: module/media + communication migration to new Module interface
**State**: pending
**Blockers**: none
**Last updated**: 2026-04-12
<!-- STATUS-END -->

# Checklist

## Wave 1 — Engine Foundation (parallel ×3) ✅

### PR-A1 — Module Core + Registry ✅ merged as `4317cdb`
- [x] engine/module_types.go — GameEvent, GameState, Phase, WinResult, Rule
- [x] engine/module.go — Core 7 interface (임시명 Plugin, PluginConfigSchema)
- [x] engine/module_optional.go — 5 optionals
- [x] engine/module_registry.go — PluginRegistry (factory, panic on dup)
- [x] engine/module_test.go — type assertion + registry coverage (100% new files)
- [x] go build && go test -race 전체 green

### PR-A2 — EventBus Rewrite ✅ merged as `fb7c592`
- [x] engine/event_bus.go — typed pub/sub (TypedEventBus, uses engine.GameEvent.Type routing key)
- [x] engine/event_bus_test.go — 14 race tests (panic isolation, 50-goroutine concurrent)
- [x] 레거시 eventbus/** 건드리지 않음 (A4 에서 삭제)

### PR-A3 — Audit Log Package ✅ merged as `5082a8a`
- [x] internal/auditlog/event.go — AuditEvent, AuditAction enum
- [x] internal/auditlog/logger.go — NoOpLogger + DBLogger (buffered, graceful drain)
- [x] internal/auditlog/store.go — DB store + pg_advisory_xact_lock for per-session seq serialize
- [x] internal/auditlog/*_test.go — unit (NoOpLogger) + testcontainers integration (100-goroutine seq uniqueness)
- [x] Migration `00018_audit_events` + sqlc queries committed

## Wave 2 — Engine Replacement (parallel ×2) ✅

### PR-A4 — PhaseEngine + Legacy Deletion + Rename ✅ merged as `96bbf27`
- [x] engine/phase_engine.go — PhaseEngine (linear phases, panic isolation, audit)
- [x] engine/phase_engine_test.go — 20 golden tests + integration_test.go
- [x] Delete: engine.go, strategy_*.go, dispatcher*.go, validation*.go (10 files, 1916 lines)
- [x] ✅ Rename: Plugin → Module — module.go/module_registry.go 삭제, PhaseHookModule/SerializableModule 리네임, SaveState 메서드 분리
- [ ] ⏭️ EventBus migration → W4 연기 (모듈 마이그레이션과 함께 진행)
- [x] session/session.go, session/manager.go 재배선 (→ PhaseEngine)
- [x] go build && go test -race 전체 green (32 packages)

### PR-A5 — Validator Chain ✅ merged as `2390add`
- [x] engine/validator.go — Validator/Chain/PhaseValidator/PlayerValidator/ModuleValidator/EventValidator
- [x] engine/validator_test.go — 12 tests (chain/phase/player/module)
- [x] ValidationState (runtime) 별도 타입으로 GameState(serializable)와 분리

## Wave 3 — Primitives (sequential)

### PR-A6 — Clue Graph
- [x] internal/clue/graph.go — Clue, Graph, Dependency (AND/OR), Resolve, HasCycle (Kahn's)
- [x] internal/clue/validator.go — Validate (orphan, cycle, unreachable)
- [x] internal/clue/visibility.go — VisibilityRule, ComputeVisible (scope priority: player>role>team>all)
- [x] internal/clue/*_test.go 97.0% coverage (target 85%)

### PR-A7 — JSON Logic Rule Evaluator ✅
- [x] engine/rule_evaluator.go — RuleEvaluator, SetContext, Evaluate, EvaluateAll, IsValid, toBool
- [x] engine/rule_evaluator_test.go — 15 unit tests (operators, var, concurrency, edge cases)
- [x] engine/rule_evaluator_parity_test.go — 49 golden fixtures, json-logic-js cross-engine parity
- [x] testdata/rule_parity_fixtures.json — shared fixture file
- [x] jsonlogic/v3 v3.9.0 dependency added
- [x] Coverage ~95% (target 85%), race clean

## Wave 4 — Module Migration (parallel ×4)

### PR-B1 — cluedist 마이그 ✅ `5396be8`
- [x] module/cluedist/*.go 새 인터페이스로 마이그
- [x] StartingClue/RoundClue/ConditionalClue Optional opt-in
- [x] Unit tests 유지 (88.8% coverage)

### PR-B2 — decision 마이그 ✅ `b5e175f`
- [x] module/decision/*.go 마이그
- [x] Voting/Accusation/HiddenMission Optional opt-in
- [x] Unit tests 유지 (89.8% coverage)

### PR-B3 — progression + exploration + core 마이그 ✅ `e76b66c`
- [x] module/progression/*.go (8 modules +PhaseHookModule)
- [x] module/exploration/*.go (4 modules +GameEventHandler +PhaseHookModule)
- [x] module/core/*.go (4 modules +GameEventHandler +SerializableModule)
- [x] Unit tests 유지 + 새 인터페이스 테스트 추가

### PR-B4 — media + communication 마이그
- [ ] module/media/*.go (MediaPlayback/BGM)
- [ ] module/communication/*.go (TextChat/GroupChat/Whisper)
- [ ] Unit tests 유지

## Wave 5 — Template System (sequential)

### PR-T1 — Template Loader + Validator
- [ ] internal/template/loader.go — go:embed
- [ ] internal/template/validator.go — 모듈 schema merge 검증
- [ ] internal/template/*_test.go
- [ ] HTTP handler GET /api/templates/{id}/schema

### PR-T2 — 4 장르 N 프리셋 JSON
- [ ] template/presets/murder_mystery/*.json
- [ ] template/presets/crime_scene/*.json
- [ ] template/presets/script_kill/*.json
- [ ] template/presets/jubensha/*.json
- [ ] Golden test — 각 프리셋 loader 검증

## Wave 6 — UI + Crime Scene (parallel ×2)

### PR-C1 — L1 SchemaDrivenForm
- [ ] apps/web/src/features/editor/SchemaDrivenForm.tsx
- [ ] apps/web/src/features/editor/SchemaField.tsx (재귀)
- [ ] apps/web/src/api/templateApi.ts (BaseAPI)
- [ ] Vitest + MSW 테스트

### PR-F1 — CrimeScene Module
- [ ] module/crime_scene/location.go
- [ ] module/crime_scene/evidence.go
- [ ] module/crime_scene/combination.go
- [ ] Unit tests

## Wave 7 — Verification

### PR-V1 — e2e Smoke
- [ ] apps/server/internal/e2e/engine_v2_test.go
- [ ] 4 장르 × 1 세션 (template load → session → phase → win/end)
- [ ] 모듈 격리 CI 게이트 추가
