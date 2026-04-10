# Phase A: Engine Core -- Implementation Plan

> Parent: [../design.md](../design.md) | Depends: Phase 8.0 | Blocks: Phase B, Phase C

---

## PR Breakdown (7 PRs, 3 Waves)

```
Wave 1 (parallel):  PR-A1 Plugin interfaces  |  PR-A2 EventBus  |  PR-A3 Audit Log
Wave 2 (sequential): PR-A4 PhaseEngine -> PR-A5 EventProcessor chain
Wave 3 (parallel):  PR-A6 Clue System  |  PR-A7 Rule Evaluator
```

---

## PR-A1: GenrePlugin Interfaces + Registry

**Files create**: `engine/plugin.go`, `engine/registry.go` (rewrite), `engine/types.go` (rewrite)
**Files remove**: `strategy_event.go`, `strategy_hybrid.go`, `strategy_script.go`, `dispatcher.go`, `validation.go`

**Core interface (7 methods, all plugins)**: `ID()`, `Name()`, `Version()`, `GetConfigSchema()`, `Init()`, `Cleanup()`, `DefaultPhases()`
**Optional (type assertion)**: `GameEventHandler` (Validate+Apply), `WinChecker` (CheckWin), `PhaseHookPlugin` (OnPhaseEnter+OnPhaseExit), `SerializablePlugin` (BuildState+RestoreState), `RuleProvider` (GetRules)

**Migration**: Keep Registry pattern (init()+blank import), rename ModuleFactory->PluginFactory. Remove Module, PhaseReactor, ProgressionStrategy interfaces.

**Tests**: mock plugin (Core only) + type assertion for each Optional; registry register/create/duplicate panic.

---

## PR-A2: EventBus (EventListener Interface)

**Files modify**: `engine/event_bus.go` (rewrite)

Replace `EventHandler func(Event)` with `EventListener interface{ OnEvent(ctx, GameEvent) error }`. Publish returns `[]error` (aggregate). Keep session-scoped, panic isolation, Close() cleanup.

**Tests**: error isolation (one fails, others continue), context cancellation.

---

## PR-A3: Audit Log (PG Append-Only)

**Files create**: `auditlog/writer.go`, `auditlog/snapshot.go`, `auditlog/event_types.go`, `migrations/XXXX_create_audit_tables.sql`
**Tests**: `auditlog/writer_test.go`, `auditlog/snapshot_test.go`

AuditWriter: async channel (cap 4096) -> batch INSERT into `game_audit_log`. SnapshotManager: Redis hot state -> `game_snapshots` (5s interval + critical immediate). DDL in `data-models.md`.

**Tests**: unit (channel drain, batch INSERT), integration (testcontainers-go + PG).

---

## PR-A4: PhaseEngine (Stateless Wrapper)

**Files create**: `engine/phase_engine.go`
**Files remove**: `engine/engine.go` (GameProgressionEngine)

`PhaseEngine` wraps `qmuntal/stateless` behind internal `fsmAdapter` interface (CurrentState, Fire, CanFire, Configure) for library swap. Phase transitions delegate to `plugin.(PhaseHookPlugin)`.

**Migration**: Keep thread-safety contract (single goroutine = Session Actor). Keep enterCurrentPhase/exitCurrentPhase lifecycle. Remove selectStrategy() and all 3 strategy files.

**Tests**: FSM transitions, guard clauses, sub-phase nesting, GM override (SkipTo).

---

## PR-A5: EventProcessor Chain

**Files create**: `engine/processor_chain.go`, `engine/validator.go` (rewrite)
**Files remove**: `engine/dispatcher.go`, `engine/validation.go` (old)

Chain: `AuthValidator -> SessionValidator -> PhaseValidator -> GenreValidator -> GenreProcessor -> WinCheckerProcessor -> PostProcessor`. Each node type-asserts plugin Optional interfaces; non-applicable = no-op.

**Tests**: chain composition, short-circuit on validation failure, optional interface skip.

---

## PR-A6: Clue System

**Files create**: `clue/graph.go`, `clue/validator.go`, `clue/visibility.go`, `clue/types.go`
**Tests**: `clue/graph_test.go`, `clue/validator_test.go`, `clue/visibility_test.go`

- **ClueGraph**: adjacency list, edge types (requires/combines_with/unlocks), TopologicalSort(), DetectCycles(), FindCombination()
- **ClueValidator**: chain (Prerequisite->Combination->Location->Role->Condition), `CanDiscover(ctx, playerID, clueID, state) error`
- **VisibilitySpec**: Specification pattern with And/Or/Not combinators (RoleSpec, PhaseSpec, ClueOwnedSpec, TeamSpec, PlayerSpec, LogicSpec)

**Tests**: cycle detection, topological sort, prerequisite blocking, combination success, composite visibility specs.

---

## PR-A7: Rule Evaluator (JSON Logic)

**Files create**: `engine/rule_evaluator.go`, `engine/rule_evaluator_test.go`
**New dep**: `diegoholiveira/jsonlogic/v2`

Stateless `RuleEvaluator` with `Evaluate(rule, data)` and `EvaluateBool(rule, data)`. Must match frontend `jsonlogic-js` exactly.

**Tests**: 100+ cross-engine parity expressions (comparison, logical, arithmetic, array ops, nested).

---

## Phase 8.0 Migration Summary

| Keep unchanged | Remove | Rewrite |
|---|---|---|
| Session Actor, SessionManager, Hub, Client, Router, BaseModuleHandler, LifecycleListener, ReconnectBuffer | GameProgressionEngine, Module interface, ProgressionStrategy, ActionDispatcher, 3 strategy files | EventBus (EventListener), Registry (PluginFactory), types.go |

---

## Gate Criteria

1. All 7 PRs merged, `go test ./internal/engine/... ./internal/auditlog/... ./internal/clue/...` passing
2. `go vet ./...` clean, `go test -race ./...` no races
3. Mock plugin (Core only) passes registry + PhaseEngine smoke test
4. Cross-engine JSON Logic parity: 100+ expressions match Go vs JS
5. Phase 8.0 `session_test.go`, `hub_test.go` pass unchanged
6. `go mod tidy` clean, no unused deps
7. Coverage >= 75% on engine/, auditlog/, clue/
