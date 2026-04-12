<!-- STATUS-START -->
**Active**: Phase 9.0 — Composable Module Engine Redesign
**Wave**: W7
**PR**: PR-V1 (e2e Smoke + Module Isolation CI Gate)
**Task**: e2e smoke tests
**State**: completed
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

### PR-B4 — media + communication 마이그 ✅ `e00246a`
- [x] module/media/*.go (audio +PhaseHookModule +GameEventHandler)
- [x] module/communication/*.go (text_chat, group_chat, whisper +GameEventHandler +SerializableModule +PhaseHookModule)
- [x] Unit tests 유지

## Wave 5 — Template System (sequential)

### PR-T1 — Template Loader + Validator ✅ `52b1fa8`
- [x] internal/template/loader.go — go:embed presets/*.json, Load/List/LoadFromBytes
- [x] internal/template/validator.go — registry check, duplicate, action target validation
- [x] internal/template/schema_merger.go — ConfigSchema merge per module
- [x] internal/template/*_test.go — 20 tests, 87.4% coverage
- [x] HTTP handler GET /api/templates, /{id}, /{id}/schema

### PR-T2 — 4 장르 N 프리셋 JSON ✅ `f6073fc`
- [x] template/presets/murder_mystery/*.json (3: classic_6p, expert_8p, quick_4p)
- [x] template/presets/crime_scene/*.json (2: 3_locations, 5_locations)
- [x] template/presets/script_kill/*.json (2: 3_rounds, 5_rounds)
- [x] template/presets/jubensha/*.json (2: first_person, third_person)
- [x] Golden test — load, validate, schema merge, genre coverage

## Wave 6 — UI + Crime Scene (parallel ×2)

### PR-C1 — L1 SchemaDrivenForm ✅ merged
- [x] templateApi.ts (React Query hooks, types)
- [x] themeStore.ts (Zustand, genre/preset/config state)
- [x] SchemaField.tsx (재귀 렌더러: string/number/boolean/enum/array/object)
- [x] SchemaDrivenForm.tsx (JSON Schema → SchemaField[] 파싱)
- [x] GenreSelect.tsx + PresetSelect.tsx (카드 기반 선택)
- [x] TemplateConfigTab.tsx + EditorLayout 통합
- [x] Vitest 27 tests (SchemaField 타입별 + 폼 + 선택 UI)

### PR-F1 — CrimeScene Module ✅ `fe46d1a`
- [x] module/crime_scene/location.go (Move/Examine, RuleProvider, Serializable)
- [x] module/crime_scene/evidence.go (Discover/Collect, PhaseHook, Serializable)
- [x] module/crime_scene/combination.go (Combine, WinChecker, clue.Graph)
- [x] register.go + blank import
- [x] Unit + integration tests (93.2% coverage)

## Wave 7 — Verification

### PR-V1 — e2e Smoke ✅
- [x] apps/server/internal/e2e/harness_test.go — reusable smoke harness
- [x] apps/server/internal/e2e/murder_mystery_test.go — classic_6p smoke
- [x] apps/server/internal/e2e/crime_scene_test.go — 3_locations smoke
- [x] apps/server/internal/e2e/script_kill_test.go — 3_rounds smoke
- [x] apps/server/internal/e2e/jubensha_test.go — first_person smoke
- [x] scripts/test-module-isolation.sh — per-module test + cross-import check
- [x] .github/workflows/module-isolation.yml — CI gate on PR to main
- [x] go test -race ./internal/e2e/... green (1.5s)
- [x] scripts/test-module-isolation.sh passes (all 8 modules isolated)
