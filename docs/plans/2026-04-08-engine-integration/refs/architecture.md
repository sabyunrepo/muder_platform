# 아키텍처 상세

> 부모: [../design.md](../design.md)

---

## 전체 다이어그램

```
┌────────────────────────────────────────────────────────────┐
│                cmd/server/main.go (DI 조립)                 │
│                                                              │
│  ┌─────────┐  ┌──────────┐  ┌─────────────────┐            │
│  │ ws.Hub  │──│  Router  │  │ SessionManager  │            │
│  │(listener│  │          │  │ (Listener impl) │            │
│  │  hook)  │  └────┬─────┘  └────┬────────────┘            │
│  └─────┬───┘       │             │                          │
│        │    ┌──────┴───────┐     │                          │
│        │    │ Module       │     │                          │
│        │    │ Handlers     │     │                          │
│        │    │ (reading,    │     │                          │
│        │    │  core_*,     │     │                          │
│        │    │  progression*)│     │                          │
│        │    └──────┬───────┘     │                          │
│        │           │ WithSession │                          │
│        │           │ Inbox<-msg  │                          │
│        │           ↓             │                          │
│        │ ┌─────────────────────────┐                        │
│        └→│ Session (1 goroutine)    │                        │
│          │  select {                │                        │
│          │    wsCh / timerCh /      │                        │
│          │    gmCh / consensusCh /  │                        │
│          │    lifecycleCh /         │                        │
│          │    snapshotCh / done     │                        │
│          │  }                       │                        │
│          │  ↓                        │                        │
│          │  engine (NO LOCKS)        │                        │
│          │  modules[] / EventBus     │                        │
│          │  ↓ Publish                │                        │
│          │  GameEventMappings        │                        │
│          │    → Hub.BroadcastToSess  │                        │
│          └──────────┬────────────────┘                        │
│                     │ 5s throttle (dirty)                     │
│                     │ critical events (immediate)             │
│                     ↓                                          │
│              ┌──────────────┐                                 │
│              │ Redis        │                                 │
│              │ session:*:*  │                                 │
│              └──────────────┘                                 │
└────────────────────────────────────────────────────────────┘
```

---

## 핵심 컴포넌트 4개

### 1. SessionManager (`internal/session/manager.go`)

```go
type SessionManager struct {
    mu       sync.RWMutex  // sessions map 보호만
    sessions map[uuid.UUID]*Session
    // 의존성
    hub       *ws.Hub
    redis     *redis.Client
    queries   *db.Queries
    voiceProv voice.VoiceProvider
    logger    zerolog.Logger
    // 메트릭
    activeGauge prometheus.Gauge
}

// 라이프사이클
func (m *SessionManager) Start(ctx, roomID, configJSON, players, host) (*Session, error)
func (m *SessionManager) Stop(ctx, sessionID, reason) error
func (m *SessionManager) Get(sessionID) *Session
func (m *SessionManager) Restore(ctx, sessionID) (*Session, error)  // Lazy

// SessionLifecycleListener 구현
func (m *SessionManager) OnPlayerLeft(sessionID, playerID uuid.UUID)
func (m *SessionManager) OnPlayerRejoined(sessionID, playerID uuid.UUID)
```

**Lock 정책**: `mu`는 sessions map만. Session 내부 데이터는 절대 만지지 않음. 모든 작업은 `session.Inbox` channel로 위임.

### 2. Session (`internal/session/session.go`)

```go
type Session struct {
    ID       uuid.UUID
    RoomID   uuid.UUID
    HostID   uuid.UUID
    engine   *engine.GameProgressionEngine  // lock 없음, 이 goroutine만 접근
    players  map[uuid.UUID]*PlayerState
    status   SessionStatus

    inbox       chan SessionMessage   // 통합 입구
    done        chan struct{}

    // 상태 (actor만 접근)
    lastSnapshotAt time.Time
    dirtySince     time.Time
    panicCount     int
}

type SessionMessage struct {
    Kind     MessageKind  // ws/gm/timer/consensus/trigger/lifecycle/critical
    PlayerID uuid.UUID
    Payload  any
    Reply    chan error   // nil = fire-and-forget
    Ctx      context.Context
}

func (s *Session) Run(ctx context.Context) {
    snapshotTicker := time.NewTicker(5 * time.Second)
    defer snapshotTicker.Stop()
    for {
        select {
        case msg := <-s.inbox:
            s.handleMessage(msg)  // panic recover 내부에서
        case <-snapshotTicker.C:
            s.maybeSnapshot()
        case <-s.done:
            return
        case <-ctx.Done():
            return
        }
    }
}
```

**키 디자인**:
- Inbox **단일 채널** + MessageKind 분기 (8-way select 대신 단순화)
- Reply chan size 1 (sender unblock 보장)
- panic recover 메시지 단위, counter 누적 (3회 abort)

### 3. BaseModuleHandler (`internal/ws/base_module_handler.go`)

```go
type BaseModuleHandler struct {
    manager *session.Manager
    logger  zerolog.Logger
}

func (h *BaseModuleHandler) WithSession(c *Client, kind MessageKind, payload any) error {
    // 1. sessionID 검증
    // 2. manager.Get(sessionID) 또는 Lazy Restore
    // 3. Reply 채널 생성
    // 4. inbox 전송 (500ms 타임아웃)
    // 5. reply 대기 (2s 타임아웃)
    // 6. 에러 시 translateError → client에 envelope
}
```

각 모듈 핸들러(예: ReadingHandler)는 이 헬퍼 호출로 boilerplate 제거.

### 4. EventMapping 테이블 (`internal/session/event_mapping.go` + 모듈별 파일)

```go
type EventMapping struct {
    EngineEventType string  // "reading.line_changed"
    WSType          string  // "reading:line_changed"
    Convert         func(payload any) (any, error)  // nil=pass-through
}

// 모듈별 파일로 분리 (병렬 wave 머지 충돌 방지)
// event_mapping.go         — 인프라
// event_mapping_reading.go — PR-4
// event_mapping_core.go    — PR-5
// event_mapping_progression.go — PR-6
```

Session.Run 안에서 subscribe 등록, 수신 시 wire 변환 후 `hub.BroadcastToSession`.

### 5. Hub Lifecycle Listener (`internal/ws/hub.go` 추가)

```go
type SessionLifecycleListener interface {
    OnPlayerLeft(sessionID, playerID uuid.UUID)
    OnPlayerRejoined(sessionID, playerID uuid.UUID)
}

func (h *Hub) RegisterLifecycleListener(l SessionLifecycleListener)
// disconnect 시 notifyPlayerLeft 호출
// JoinSession 시 reconnect 감지하여 notifyPlayerRejoined 호출
```

단방향 의존 (Hub → listener interface ← SessionManager).
