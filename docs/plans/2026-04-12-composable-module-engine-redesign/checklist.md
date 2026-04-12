<!-- STATUS-START -->
**Active**: Phase 9.0 — Composable Module Engine Redesign
**Wave**: W1
**PR**: PR-A1 (Module Core + Registry)
**Task**: Module Core 7 + Optional 5 + Registry + types + tests
**State**: pending
**Blockers**: none
**Last updated**: 2026-04-12
<!-- STATUS-END -->

# Checklist

## Wave 1 — Engine Foundation (parallel ×3)

### PR-A1 — Module Core + Registry
- [ ] engine/module_types.go — GameEvent, GameState, Phase, WinResult, Rule
- [ ] engine/module.go — Core 7 interface (temp name Plugin)
- [ ] engine/module_optional.go — 5 optionals
- [ ] engine/module_registry.go — PluginRegistry (factory, panic on dup)
- [ ] engine/module_test.go — type assertion + registry coverage 75%+
- [ ] go build && go test -race 전체 green

### PR-A2 — EventBus Rewrite
- [ ] engine/event_bus.go — typed pub/sub (replaces callback style)
- [ ] engine/event_bus_test.go — race tests
- [ ] 레거시 eventbus/** 는 건드리지 않음 (A4 에서 삭제)

### PR-A3 — Audit Log Package
- [x] internal/auditlog/event.go — AuditEvent, AuditAction
- [x] internal/auditlog/logger.go — append-only logger
- [x] internal/auditlog/store.go — DB store (sqlc)
- [x] internal/auditlog/*_test.go — unit + integration

## Wave 2 — Engine Replacement (parallel ×2)

### PR-A4 — PhaseEngine + Legacy Deletion + Rename (빅뱅)
- [ ] engine/phase_engine.go — JSON template 구동
- [ ] engine/phase_engine_test.go
- [ ] Delete: engine.go, strategy_*.go, dispatcher.go, validation.go, types.go(legacy bits)
- [ ] Delete: internal/eventbus/** 패키지
- [ ] Rename: engine.Plugin → engine.Module (32 consumer 파일 동시 수정)
- [ ] session/session.go, session/manager.go 재배선
- [ ] go build && go test -race 전체 green

### PR-A5 — Validator Chain
- [ ] engine/validator.go — Validator interface + Chain
- [ ] engine/validator_test.go
- [ ] Replace validation.go 호출부

## Wave 3 — Primitives (sequential)

### PR-A6 — Clue Graph
- [ ] internal/clue/graph.go
- [ ] internal/clue/validator.go
- [ ] internal/clue/visibility.go
- [ ] internal/clue/*_test.go 75%+

### PR-A7 — JSON Logic Rule Evaluator
- [ ] engine/rule_evaluator.go
- [ ] engine/rule_evaluator_test.go — 크로스 엔진 패리티

## Wave 4 — Module Migration (parallel ×4)

### PR-B1 — cluedist 마이그
- [ ] module/cluedist/*.go 새 인터페이스로 마이그
- [ ] StartingClue/RoundClue/ConditionalClue Optional opt-in
- [ ] Unit tests 유지

### PR-B2 — decision 마이그
- [ ] module/decision/*.go 마이그
- [ ] Voting/Accusation/HiddenMission Optional opt-in
- [ ] Unit tests 유지

### PR-B3 — progression + exploration 마이그
- [ ] module/progression/*.go (Timer/Ready/Ending)
- [ ] module/exploration/*.go
- [ ] Unit tests 유지

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
