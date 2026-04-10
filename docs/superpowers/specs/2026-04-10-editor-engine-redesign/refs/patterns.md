# 디자인패턴 적용 상세

> 부모: [../design.md](../design.md)

---

## 1. Creational Patterns

### 1.1 Factory Method (모듈 등록)

**위치**: `internal/engine/registry.go`
**목적**: 새 GenrePlugin을 추가할 때 기존 코드 변경 없이 등록

```go
// Registry — 플러그인 팩토리 레지스트리
type Registry struct {
    mu      sync.RWMutex
    plugins map[string]PluginFactory
}

type PluginFactory func() GenrePlugin

func (r *Registry) Register(id string, factory PluginFactory) {
    r.mu.Lock()
    defer r.mu.Unlock()
    r.plugins[id] = factory
}

func (r *Registry) Create(id string) (GenrePlugin, error) {
    r.mu.RLock()
    factory, ok := r.plugins[id]
    r.mu.RUnlock()
    if !ok {
        return nil, ErrPluginNotFound(id)
    }
    return factory(), nil
}

// 각 장르 플러그인은 init()에서 자동 등록
func init() {
    engine.DefaultRegistry.Register("crime_scene", func() GenrePlugin {
        return NewCrimeScenePlugin()
    })
}
```

**효과**: OCP (Open/Closed Principle) — 확장은 open, 수정은 closed

### 1.2 Builder (ConfigSchema → Editor UI)

**위치**: `apps/web/src/features/editor/hooks/useSchemaToForm.ts`
**목적**: JSON Schema에서 폼 필드를 자동 생성

```go
// SchemaBuilder — ConfigSchema를 UI 스펙으로 변환
type FormFieldSpec struct {
    Key         string
    Label       string
    Type        string  // "text" | "number" | "select" | "toggle" | "array"
    Options     []Option
    Min, Max    *float64
    Default     any
    Required    bool
    Group       string
}

type SchemaBuilder struct {
    schema json.RawMessage
}

func (b *SchemaBuilder) Build() []FormFieldSpec {
    // JSON Schema → FormFieldSpec 변환
    // enum → select, boolean → toggle, integer → number, etc.
}
```

**효과**: Plugin이 ConfigSchema만 정의하면 에디터 UI가 자동 생성됨

---

## 2. Structural Patterns

### 2.1 Strategy (GenrePlugin)

**위치**: `internal/engine/plugin.go`
**목적**: 장르별 게임 로직을 인터페이스 뒤에 숨김

```go
// GenrePlugin — 전략 인터페이스
type GenrePlugin interface {
    ID() string
    Name() string
    GetConfigSchema() json.RawMessage
    Init(ctx context.Context, config json.RawMessage) error
    Validate(ctx context.Context, event GameEvent, state GameState) error
    Apply(ctx context.Context, event GameEvent, state GameState) (GameState, error)
    CheckWin(ctx context.Context, state GameState) (*WinResult, error)
    OnPhaseEnter(ctx context.Context, phase Phase, state GameState) (GameState, error)
    OnPhaseExit(ctx context.Context, phase Phase, state GameState) (GameState, error)
    DefaultPhases() []PhaseDefinition
    GetRules() []Rule
    BuildState() (json.RawMessage, error)
    RestoreState(data json.RawMessage) error
    Cleanup(ctx context.Context) error
}
```

**효과**: 엔진 코어는 장르를 모름. 새 장르 = 새 구현체 하나.

### 2.2 Decorator (PhaseAction Pipeline)

**위치**: `internal/engine/pipeline.go`
**목적**: 이벤트 처리에 전/후처리를 자유롭게 추가

```go
// EventProcessor — 데코레이터 체인 (명령 파이프라인)
type EventProcessor interface {
    Process(ctx context.Context, event GameEvent, state GameState) (GameState, error)
    SetNext(next EventProcessor) EventProcessor
}

// PreValidator — 인증/권한/세션 상태 검증
type PreValidator struct {
    next EventProcessor
}
func (v *PreValidator) Process(ctx context.Context, event GameEvent, state GameState) (GameState, error) {
    if err := v.validate(event, state); err != nil {
        return state, err
    }
    return v.next.Process(ctx, event, state)
}

// GenreProcessor — 장르별 처리 (Plugin 위임)
type GenreProcessor struct {
    plugin GenrePlugin
    next   EventProcessor
}

// WinChecker — 승리조건 확인
type WinChecker struct {
    plugin GenrePlugin
    next   EventProcessor
}

// PostProcessor — 사이드 이펙트 (알림/로그/배치)
type PostProcessor struct {
    next EventProcessor
}

// 체인 구성
processor := &PreValidator{}
processor.SetNext(&GenreProcessor{plugin: p}).SetNext(&WinChecker{plugin: p}).SetNext(&PostProcessor{})
```

**효과**: 새 검증/처리 단계를 체인에 삽입만으로 추가 가능

### 2.3 Graph (단서 의존성)

**위치**: `internal/clue/graph.go`
**목적**: 단서 간 의존성/조합을 인접 리스트 그래프로 표현

```go
// ClueGraph — 단서 의존성/조합 그래프 (인접 리스트)
type ClueGraph struct {
    nodes map[string]*ClueGraphNode
    edges map[string][]ClueEdge
}

// 위상 정렬로 발견 가능 순서 계산
func (g *ClueGraph) TopologicalSort() ([]string, error)

// 순환 참조 검출
func (g *ClueGraph) DetectCycles() [][]string

// 조합 규칙 조회
func (g *ClueGraph) FindCombination(inputClueIDs []string) *Clue
```

**효과**: 복잡한 단서 관계를 그래프 알고리즘으로 평가

### 2.4 Adapter (Bridge Layer)

**위치**: `internal/bridge/`
**목적**: WebSocket 메시지 → Session Actor → Plugin 인터페이스 변환

```go
// BaseModuleHandler — WS 메시지를 Actor 메시지로 변환
type BaseModuleHandler struct {
    manager *session.Manager
    logger  zerolog.Logger
}

func (h *BaseModuleHandler) WithSession(c *ws.Client, kind MessageKind, payload any) error {
    session := h.manager.Get(c.SessionID())
    reply := make(chan error, 1)
    session.Inbox() <- SessionMessage{Kind: kind, PlayerID: c.PlayerID(), Payload: payload, Reply: reply}
    return <-reply
}
```

**효과**: WS 계층과 엔진 계층의 결합도 제거

---

## 3. Behavioral Patterns

### 3.1 Observer (Event Bus)

**위치**: `internal/engine/event_bus.go`
**목적**: 모듈 간 느슨한 결합으로 이벤트 통신

```go
// EventListener — EventBus 구독자 (Observer, 부수효과 전용)
type EventListener interface {
    OnEvent(ctx context.Context, event GameEvent) error
}

// EventBus — 세션 스코프 이벤트 버스
type EventBus struct {
    mu       sync.RWMutex
    listeners map[EventType][]EventListener
}

func (b *EventBus) Subscribe(eventType EventType, listener EventListener) {
    b.mu.Lock()
    defer b.mu.Unlock()
    b.listeners[eventType] = append(b.listeners[eventType], listener)
}

// Publish — 에러 격리: 하나 실패해도 다른 리스너 계속. 에러 로깅 + 반환
func (b *EventBus) Publish(ctx context.Context, event GameEvent) []error {
    b.mu.RLock()
    listeners := b.listeners[event.Type()]
    b.mu.RUnlock()
    var errs []error
    for _, l := range listeners {
        if err := l.OnEvent(ctx, event); err != nil {
            errs = append(errs, err)
        }
    }
    return errs
}
```

### 3.2 Chain of Responsibility (Validator Chain)

**위치**: `internal/engine/validator_chain.go`
**목적**: 이벤트 검증을 여러 단계로 체이닝

```go
// Validator — 검증 체인 노드
type Validator interface {
    Validate(ctx context.Context, event GameEvent, state GameState) error
    SetNext(next Validator) Validator
}

// AuthValidator → SessionValidator → PhaseValidator → GenreValidator
chain := NewAuthValidator().SetNext(NewSessionValidator()).SetNext(NewPhaseValidator()).SetNext(NewGenreValidator(plugin))
```

### 3.3 State (Phase Engine)

**위치**: `internal/engine/phase_engine.go`
**목적**: 계층형 페이즈 상태머신 (phase > subphase > round)

```go
// PhaseEngine — stateless 계층형 FSM (qmuntal/stateless 기반)
type PhaseEngine struct {
    machine *stateless.StateMachine
    plugin  GenrePlugin
}

// 상태 계층: phase → subphase → round
// transition: onEnter/onExit 훅 → Plugin 위임
// guard: Plugin.Validate로 전환 가능 여부 확인
```

### 3.4 Specification (가시성 규칙)

**위치**: `internal/clue/visibility.go`
**목적**: 복잡한 단서 가시성 조건을 조합 가능하게 표현

```go
// VisibilitySpec — 가시성 명세 (Specification 패턴)
type VisibilitySpec interface {
    IsSatisfiedBy(playerID string, state GameState) bool
    And(other VisibilitySpec) VisibilitySpec
    Or(other VisibilitySpec) VisibilitySpec
    Not() VisibilitySpec
}

type RoleSpec struct{ role string }
type PhaseSpec struct{ phase string }
type ClueOwnedSpec struct{ clueID string }
type TeamSpec struct{ team string }
type LogicSpec struct{ rule json.RawMessage } // JSON Logic

// 사용 예
spec := NewRoleSpec("detective").And(NewPhaseSpec("investigation"))
visible := spec.IsSatisfiedBy(playerID, state)
```

### 3.5 Template Method (Session Lifecycle)

**위치**: `internal/session/session.go`
**목적**: 세션 라이프사이클의 골격을 정의, 장르별 세부 동작은 Plugin에 위임

```go
func (s *Session) Run(ctx context.Context) {
    // Template Method: 라이프사이클 골격은 고정
    for {
        select {
        case msg := <-s.inbox:
            s.handleMessage(msg) // Plugin 호출 포인트
        case <-s.snapshotTicker.C:
            s.maybeSnapshot()
        case <-s.done:
            s.plugin.Cleanup(ctx) // 정리 위임
            return
        }
    }
}
```

---

## 4. Architectural Patterns

### 4.1 Event Sourcing + CQRS

**위치**: `internal/eventstore/`
**목적**: 모든 상태 변경을 이벤트로 기록, 조회는 별도 모델

```
Command → Validator Chain → Aggregate (Session Actor)
    → Event Store (PostgreSQL) → EventBus
        → Projector → Read Model (Redis)
        → WebSocket (Hub.Broadcast)
```

### 4.2 Actor Model

**위치**: `internal/session/session.go`
**목적**: 단일 goroutine으로 race condition 원천 차단

### 4.3 Plugin Architecture

**위치**: `internal/engine/plugin.go`
**목적**: init() + Factory 등록으로 핫 로드, 독립 개발

### 4.4 Progressive Disclosure (Editor UX)

**위치**: `apps/web/src/features/editor/`
**목적**: Layer 1(템플릿) → Layer 2(타임라인) → Layer 3(노드 에디터) 점진적 노출
