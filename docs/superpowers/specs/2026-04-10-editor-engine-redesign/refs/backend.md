# 백엔드 아키텍처 상세

> 부모: [../design.md](../design.md)

## Phase 8.0 코드 처리

Phase 8.0의 Session/SessionManager/Hub 코드는 **구조적으로 유지**하되, 내부 엔진은 GenrePlugin으로 교체합니다:
- **유지**: Session Actor, SessionManager, Hub, Client, Router, BaseModuleHandler, LifecycleListener, ReconnectBuffer
- **교체**: GameProgressionEngine → PhaseEngine + GenrePlugin, Module interface → GenrePlugin, ProgressionStrategy → Plugin 내부
- **폐기**: Module 등록 init() 패턴 (Plugin init()으로 대체), PhaseAction 12종 디스패치 (Plugin.Validate/Apply로 대체)

기존 12개 모듈의 로직은 해당 장르 Plugin 내부로 흡수합니다 (예: connection, room, ready는 모든 Plugin이 공통 구현, reading은 ScriptKillPlugin이 내장).

---

## 패키지 구조

```
apps/server/internal/
├── cmd/server/main.go              # DI 조립 (Composition Root)
├── engine/                          # 게임 엔진 코어
│   ├── registry.go                  # Plugin 레지스트리 (Factory)
│   ├── plugin.go                    # GenrePlugin 인터페이스
│   ├── phase_engine.go              # 계층형 Phase FSM (State 패턴)
│   ├── event_bus.go                 # 세션 스코프 Event Bus (Observer)
│   ├── pipeline.go                  # EventHandler 데코레이터 체인
│   ├── validator_chain.go           # Validator Chain of Responsibility
│   └── action_dispatcher.go         # PhaseAction → Reactor 디스패치
├── session/                         # Session Actor
│   ├── manager.go                   # SessionManager (생명주기)
│   ├── session.go                   # Session (1 goroutine, Template Method)
│   └── message.go                   # SessionMessage 타입
├── eventstore/                      # Event Sourcing (PostgreSQL)
│   ├── store.go                     # EventStore (append, load, replay)
│   ├── snapshot.go                  # Snapshot 관리 (100 events / 5s)
│   ├── projector.go                 # Read Model projector
│   └── event_types.go               # 이벤트 타입 정의
├── clue/                            # 단서 시스템
│   ├── graph.go                     # 의존성 그래프 (Composite)
│   ├── validator.go                 # ClueValidator (Chain of Resp)
│   ├── visibility.go                # VisibilitySpec (Specification)
│   └── types.go                     # Clue, ClueType 등
├── ws/                              # WebSocket
│   ├── hub.go                       # Hub + LifecycleListener
│   ├── client.go                    # Client
│   ├── router.go                    # Message Router
│   └── base_module_handler.go       # BaseModuleHandler (Adapter)
├── bridge/                          # WS ↔ Engine 브릿지
│   ├── event_mapping.go             # EventMapping 테이블
│   └── module_handler_factory.go    # 모듈별 핸들러 생성
├── genre/                           # 장르별 Plugin 구현
│   ├── crime_scene/                 # 크라임씬
│   │   ├── plugin.go
│   │   ├── phases.go
│   │   ├── rules.go
│   │   └── schema.go
│   ├── script_kill/                 # 스크립트킬
│   ├── jubensha/                    # 쥬번샤
│   └── murder_mystery/              # 머더미스터리
├── domain/                          # 도메인 서비스 (기존 유지)
│   ├── room/
│   ├── editor/
│   ├── auth/
│   └── ...
└── infra/                           # 인프라 (기존 유지)
    ├── postgres/
    ├── redis/
    └── ...
```

---

## 핵심 인터페이스

### GenrePlugin (Strategy)

> Plugin 에러는 기존 `apperror.AppError` (RFC 9457 Problem Details)를 사용합니다.

```go
type GenrePlugin interface {
    // 식별
    ID() string
    Name() string
    Version() string

    // 스키마 (에디터 자동 UI용)
    GetConfigSchema() json.RawMessage
    GetStateSchema() json.RawMessage

    // 라이프사이클
    Init(ctx context.Context, config json.RawMessage) error
    Cleanup(ctx context.Context) error

    // 이벤트 처리 핵심
    Validate(ctx context.Context, event GameEvent, state GameState) error
    Apply(ctx context.Context, event GameEvent, state GameState) (GameState, error)
    CheckWin(ctx context.Context, state GameState) (*WinResult, error)

    // Phase 훅
    OnPhaseEnter(ctx context.Context, phase Phase, state GameState) (GameState, error)
    OnPhaseExit(ctx context.Context, phase Phase, state GameState) (GameState, error)

    // 기본값
    DefaultPhases() []PhaseDefinition
    GetRules() []Rule

    // 직렬화
    BuildState() (json.RawMessage, error)
    RestoreState(data json.RawMessage) error
}
```

### EventProcessor (Decorator Chain)

```go
type EventProcessor interface {
    Process(ctx context.Context, event GameEvent, state GameState) (GameState, error)
    SetNext(next EventProcessor) EventProcessor
}
```

체인: `AuthValidator → SessionValidator → PhaseValidator → GenreValidator → GenreProcessor → WinChecker → PostProcessor`

### SessionLifecycleListener (Observer)

```go
type SessionLifecycleListener interface {
    OnPlayerLeft(sessionID, playerID uuid.UUID)
    OnPlayerRejoined(sessionID, playerID uuid.UUID)
}
```

### VisibilitySpec (Specification)

> 상세 구현은 `clue-system.md`의 Specification 패턴 섹션 참조

```go
// VisibilitySpec — 단서 가시성 명세 (Specification 패턴)
type VisibilitySpec interface {
    IsSatisfiedBy(playerID string, state GameState) bool
    And(other VisibilitySpec) VisibilitySpec
    Or(other VisibilitySpec) VisibilitySpec
    Not() VisibilitySpec
}
```

---

## 이벤트 처리 파이프라인

```
WebSocket Message
    │
    ▼
BaseModuleHandler (Adapter)
    │ WS → SessionMessage 변환
    ▼
Session.Inbox (Actor)
    │ 단일 goroutine select
    ▼
EventHandler Chain (Decorator)
    ├─ AuthValidator      → 인증/권한
    ├─ SessionValidator   → 세션 상태
    ├─ PhaseValidator     → 페이즈 호환성
    ├─ GenreValidator     → 장르별 규칙 (Plugin.Validate)
    ├─ GenreProcessor     → 상태 변경 (Plugin.Apply)
    ├─ WinChecker         → 승리조건 (Plugin.CheckWin)
    └─ PostProcessor      → 사이드 이펙트
    │
    ▼
Event Store (PostgreSQL)
    │ 이벤트 영속 저장
    ▼
Event Bus (Observer)
    │ 구독자 통지
    ├─ Projector → Redis Read Model 갱신
    ├─ EventMapping → Hub.BroadcastToSession
    └─ Snapshot Manager → 100 events / 5s 스냅샷
```

---

## 상태 복원 흐름

```
Session 시작/재접속
    │
    ▼
EventStore.LoadLatestSnapshot(sessionID)
    │ 최신 스냅샷 로드
    ▼
EventStore.LoadEventsSince(sessionID, snapshotVersion)
    │ 스냅샷 이후 이벤트 로드
    ▼
Session.Replay(snapshot + events)
    │ Plugin.RestoreState(pluginState)
    ▼
Redis.SetHotState(sessionID, fullState)
    │ 핫 스테이트 복원
    ▼
Hub.SendFullState(client, state)
    │ 클라이언트에 전체 상태 전송
```

---

## WebSocket 프로토콜

```json
// 클라이언트 → 서버 (Command)
{ "type": "game.action", "module": "voting", "action": "cast_vote", "payload": {...}, "seq": 42 }

// 서버 → 클라이언트 (Event)
{ "type": "game.event", "event": "vote.result", "payload": {...}, "seq": 42 }

// 서버 → 클라이언트 (State Sync)
{ "type": "game.state", "phase": "discussion", "round": 2, "timer": { "remaining": 120 }, "delta": {...} }
```

---

## Redis 키 구조

> 모든 `session:*` 키는 **24시간 TTL**, 매 write 시 갱신. Event Store가 source of truth.

```
session:{id}:state        → JSON (현재 게임 상태)
session:{id}:players      → HASH (player_id → status)
session:{id}:phase        → STRING (현재 phase_id)
session:{id}:timer        → STRING (남은 시간 ms)
session:{id}:clues        → HASH (player_id → [clue_ids])
session:{id}:lock         → STRING (분산 락, TTL 30s)
theme:{id}:schema         → JSON (캐시된 ConfigSchema, 1h TTL)
```
