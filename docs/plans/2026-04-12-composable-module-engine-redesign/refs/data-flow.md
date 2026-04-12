# Data Flow

## 세션 시작 플로우

```
1. Client                  POST /api/sessions {template_id: "mm-classic-6p"}
2. Server.SessionHandler   → TemplateLoader.Load("mm-classic-6p")
3. TemplateLoader          → embed FS 에서 JSON 읽기 + Validator.Validate
4. TemplateValidator       → for each module in template:
                             - registry.Has(module.id) → ok
                             - schema merger.Validate(module.config, Module.GetConfigSchema())
5. Server                  → for each module in template:
                             - instance = registry.Create(module.id)
                             - instance.Init(ctx, module.config)
6. Server                  → PhaseEngine.Init(instances, template.Phases)
7. PhaseEngine             → EventBus.Subscribe(instances implementing GameEventHandler)
8. PhaseEngine             → first_phase → PhaseHookPlugin.OnPhaseEnter (for each opt-in)
9. Server                  → auditlog.Append("session.start", session_id)
10. Response               ← 201 {session_id, ws_url}
```

## 이벤트 처리 플로우

```
1. WS client               → {type: "game.action", module: "decision.voting", action: "cast_vote", payload}
2. Server.WSHandler        → parse → GameEvent
3. PhaseEngine.Step(event) → Validator.Chain.Validate (phase/player/module chain)
4. Validator chain         → for each instance implementing GameEventHandler:
                             - instance.Validate(ctx, event, state)
                             - first error → short-circuit
5. PhaseEngine             → defer recover() (panic isolation)
6. PhaseEngine             → for each instance implementing GameEventHandler:
                             - newState = instance.Apply(ctx, event, state)
                             - state = newState
7. PhaseEngine             → auditlog.Append("player.action", session_id, event)
8. PhaseEngine             → for each instance implementing WinChecker:
                             - result = instance.CheckWin(ctx, state)
                             - if result != nil → start ending phase
9. PhaseEngine             → EventBus.Publish(resulting events)
10. Server                 → WS broadcast {type: "game.event", ...}
11. Server                 → WS broadcast {type: "game.state", delta: ...}
```

## 페이즈 전환 플로우

```
1. Trigger (timer expire / explicit action / condition met)
2. PhaseEngine             → current_phase.OnPhaseExit callbacks (reverse order)
3. PhaseEngine             → for each PhaseHookPlugin in reverse:
                             - instance.OnPhaseExit(ctx, current_phase, state)
                             - merge returned state
4. PhaseEngine             → auditlog.Append("phase.exit", ...)
5. PhaseEngine             → next_phase 결정 (template 순서 or 조건부 분기)
6. PhaseEngine             → for each PhaseHookPlugin in declaration order:
                             - instance.OnPhaseEnter(ctx, next_phase, state)
                             - merge returned state
7. PhaseEngine             → auditlog.Append("phase.enter", ...)
8. Server                  → WS broadcast {type: "game.state", phase: ...}
```

## 스냅샷 플로우

```
1. Trigger (periodic / phase boundary / on demand)
2. SnapshotService         → state = PhaseEngine.GetState()
3. SnapshotService         → for each SerializablePlugin:
                             - data = instance.BuildState()
                             - state.PluginStates[module_id] = data
4. SnapshotService         → db.InsertSnapshot(session_id, round, state_json)
5. auditlog                → "snapshot.created"
```

## 복구 플로우

```
1. Server restart / session resume
2. SnapshotService         → latest = db.LatestSnapshot(session_id)
3. Server                  → for each module in template:
                             - instance = registry.Create(module.id)
                             - instance.Init(ctx, module.config)
                             - if SerializablePlugin:
                               - instance.RestoreState(latest.PluginStates[module_id])
4. PhaseEngine             → resume from latest.Phase
```

## 프론트 에디터 플로우

```
1. User                    → 장르 선택 "murder_mystery"
2. Editor                  → GET /api/templates?genre=murder_mystery
3. User                    → 프리셋 선택 "mm-classic-6p"
4. Editor                  → GET /api/templates/mm-classic-6p/schema
5. Server                  → TemplateLoader.Load → schemaMerger.Merge → return JSON Schema
6. Editor                  → SchemaDrivenForm(schema) → 자동 폼 렌더
7. User                    → 필드 수정 → themeStore 업데이트 → debounced autosave
8. Editor                  → POST /api/themes {template_id, overrides}
9. Server                  → Validator.Validate(theme, schema) → DB store
```
