# Architecture

## 두 층 모듈 구조

**장르 = JSON 템플릿** (데이터, 코드 없음)
**모듈 = 재사용 Go 구현체** (ISP Core 7 + Optional 5)

## 패키지 레이아웃

```
apps/server/internal/
├── engine/                    엔진 코어
│   ├── module.go              Core 7 (temp: Plugin)       [A1]
│   ├── module_optional.go     Optional 5                  [A1]
│   ├── module_types.go        GameEvent/State/Phase/...   [A1]
│   ├── module_registry.go     PluginRegistry              [A1]
│   ├── event_bus.go           typed pub/sub               [A2]
│   ├── phase_engine.go        JSON-driven phase machine   [A4]
│   ├── rule_evaluator.go      JSON Logic                  [A7]
│   └── validator.go           validation chain            [A5]
│
├── module/                    재사용 모듈 (Phase 8.0 대부분 생존)
│   ├── cluedist/              StartingClue/RoundClue/Conditional  [B1]
│   ├── decision/              Voting/Accusation/HiddenMission     [B2]
│   ├── progression/           Timer/Ready/Ending                   [B3]
│   ├── exploration/           Location 기타                         [B3]
│   ├── media/                 MediaPlayback/BGM                     [B4]
│   ├── communication/         TextChat/GroupChat/Whisper            [B4]
│   ├── core/                  공통                                  [B1~B4]
│   └── crime_scene/           Location/Evidence/Combination (신규)  [F1]
│
├── clue/                      ClueGraph primitive          [A6]
├── auditlog/                  append-only event log        [A3]
└── template/                  JSON 템플릿 시스템            [T1/T2]
    ├── loader.go              go:embed loader
    ├── validator.go           schema merge + validate
    └── presets/               go:embed 4 장르
        ├── murder_mystery/*.json
        ├── crime_scene/*.json
        ├── script_kill/*.json
        └── jubensha/*.json
```

## 인터페이스 설계 — ISP Core 7 + Optional 5

### Core (모든 모듈 필수)
1. `ID() string`
2. `Name() string`
3. `Version() string`
4. `GetConfigSchema() json.RawMessage` — 에디터 폼 자동 생성
5. `Init(ctx, config json.RawMessage) error`
6. `Cleanup(ctx) error`
7. `DefaultConfig() json.RawMessage` — 에디터 기본값

### Optional (type assertion 으로 감지)
1. `GameEventHandler` — Validate + Apply (이벤트 처리)
2. `WinChecker` — CheckWin (승리 판정)
3. `PhaseHookPlugin` — OnPhaseEnter/Exit (페이즈 훅)
4. `SerializablePlugin` — BuildState/RestoreState (스냅샷)
5. `RuleProvider` — GetRules (JSON Logic 룰 제공)

## JSON 템플릿 구조 (예시)

```json
{
  "id": "mm-classic-6p",
  "genre": "murder_mystery",
  "version": "1.0.0",
  "name": "Classic Murder Mystery (6P)",
  "modules": [
    {"id": "cluedist.starting", "config": {...}},
    {"id": "cluedist.round", "config": {"rounds": 3}},
    {"id": "decision.voting", "config": {"type": "plurality"}},
    {"id": "decision.accusation", "config": {}}
  ],
  "phases": [
    {"id": "intro", "type": "briefing", "duration": 300},
    {"id": "round1", "type": "discussion", "duration": 600},
    {"id": "vote", "type": "voting", "duration": 120},
    {"id": "reveal", "type": "ending"}
  ],
  "rules": [...JSON Logic...]
}
```

## 세션 라이프사이클

```
1. Client: POST /api/sessions {template_id}
2. Server: template.Load(id) → validate against module schemas
3. Server: for each module in template → registry.Create(id)
4. Server: PhaseEngine.Init(modules, phases)
5. Server: EventBus.Subscribe(modules implementing GameEventHandler)
6. Server: start first phase → PhaseHookPlugin.OnPhaseEnter
7. ...game loop...
8. Server: WinChecker.CheckWin after each event
9. Server: on end → PhaseHookPlugin.OnPhaseExit (reverse) → Cleanup (reverse)
10. Server: SerializablePlugin.BuildState → snapshot store
```

## 프론트 구조 (L1 MVP)

```
apps/web/src/features/editor/
├── SchemaDrivenForm.tsx      JSON Schema → 폼 UI 자동 생성
├── SchemaField.tsx           필드 타입별 렌더 (재귀)
└── EditorPage.tsx            장르 선택 → 프리셋 → 폼

apps/web/src/api/
└── templateApi.ts            BaseAPI 상속, GET /api/templates/{id}/schema
```

L2/L3 (타임라인, 노드 에디터) 는 별도 phase.
