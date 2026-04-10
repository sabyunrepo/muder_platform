# 백엔드 아키텍처 상세

> 부모: [../design.md](../design.md)

## Phase 8.0 코드 처리 (점진적 발전)

Phase 8.0의 기반 코드를 최대한 재사용하면서 GenrePlugin으로 발전시킵니다:

### 유지 (변경 없음)
- Session Actor (`session/session.go`) — goroutine event loop, inbox, done
- SessionManager (`session/manager.go`) — 생명주기, Lazy restore
- Hub, Client, Router (`ws/`) — WebSocket 인프라
- BaseModuleHandler (`ws/base_module_handler.go`) — WS→Actor 변환
- SessionLifecycleListener (`ws/lifecycle.go`) — 연결/재접속 이벤트
- ReconnectBuffer — 재접속 메시지 버퍼

### 리팩토링
- `GameProgressionEngine` → `PhaseEngine`으로 축소 (Plugin이 로직 소유)
- `Module` interface → `GenrePlugin` Core interface로 대체
- `ProgressionStrategy` → Plugin 내부 구현 (인터페이스 삭제)
- `EventBus` callback → `EventListener` interface로 타입 안전화

### Git 전략
- `main`에서 `feat/editor-engine-redesign` 브랜치 생성
- Phase 8.0에서 유지하는 코드는 그대로 복사
- 교체되는 코드는 새 인터페이스로 리팩토링 후 커밋

---

## 패키지 구조

```
apps/server/internal/
├── cmd/server/main.go              # DI 조립 (Composition Root)
├── engine/                          # 게임 엔진 코어
│   ├── registry.go                  # Plugin 레지스트리 (Factory)
│   ├── plugin.go                    # GenrePlugin Core + Optional 인터페이스
│   ├── phase_engine.go              # 계층형 Phase FSM (stateless wrapper)
│   ├── event_bus.go                 # 세션 스코프 Event Bus (Observer)
│   ├── processor_chain.go           # EventProcessor 체인
│   └── validator.go                 # 이벤트 검증 (함수 합성)
├── session/                         # Session Actor (Phase 8.0 유지)
│   ├── manager.go
│   ├── session.go
│   └── message.go
├── auditlog/                        # 게임 이벤트 감사 로그
│   ├── writer.go                    # 비동기 PG writer (INSERT only)
│   ├── snapshot.go                  # Redis → PG 스냅샷
│   └── event_types.go               # 이벤트 타입 정의
├── clue/                            # 단서 시스템
│   ├── graph.go                     # 의존성 그래프
│   ├── validator.go                 # ClueValidator
│   ├── visibility.go                # VisibilitySpec (Specification)
│   └── types.go
├── ws/                              # WebSocket (Phase 8.0 유지)
├── bridge/                          # WS ↔ Engine 브릿지 (Phase 8.0 유지)
├── genre/                           # 장르별 Plugin
│   ├── shared/                      # 공통 유틸 (모든 Plugin이 사용)
│   │   ├── connection.go            # 접속/재접속 공통 로직
│   │   └── timer.go                 # 타이머 공통 로직
│   ├── crime_scene/
│   ├── script_kill/
│   ├── jubensha/
│   └── murder_mystery/
├── domain/                          # 도메인 서비스 (기존 유지)
└── infra/                           # 인프라 (기존 유지)
```

---

## 핵심 인터페이스

### GenrePlugin Core (7 methods — 모든 Plugin 필수)

```go
// GenrePlugin — 장르별 게임 로직 핵심 인터페이스
type GenrePlugin interface {
    // 식별
    ID() string
    Name() string
    Version() string

    // 스키마 (에디터 자동 UI용)
    GetConfigSchema() json.RawMessage

    // 라이프사이클
    Init(ctx context.Context, config json.RawMessage) error
    Cleanup(ctx context.Context) error

    // 기본값
    DefaultPhases() []PhaseDefinition
}
```

### GenrePlugin Optional (Go type assertion)

```go
// 이벤트 처리가 필요한 Plugin만 구현
type GameEventHandler interface {
    Validate(ctx context.Context, event GameEvent, state GameState) error
    Apply(ctx context.Context, event GameEvent, state GameState) (GameState, error)
}

// 승리조건이 있는 Plugin만 구현 (Jubensha는 없을 수 있음)
type WinChecker interface {
    CheckWin(ctx context.Context, state GameState) (*WinResult, error)
}

// 페이즈 전/후 훅이 필요한 Plugin만 구현
type PhaseHookPlugin interface {
    OnPhaseEnter(ctx context.Context, phase Phase, state GameState) (GameState, error)
    OnPhaseExit(ctx context.Context, phase Phase, state GameState) (GameState, error)
}

// 상태 직렬화가 필요한 Plugin만 구현
type SerializablePlugin interface {
    BuildState() (json.RawMessage, error)
    RestoreState(data json.RawMessage) error
}

// 규칙을 정의하는 Plugin만 구현
type RuleProvider interface {
    GetRules() []Rule
}

// 사용 예 (engine 내부)
func (e *PhaseEngine) checkWin(ctx context.Context, state GameState) (*WinResult, error) {
    if wc, ok := e.plugin.(WinChecker); ok {
        return wc.CheckWin(ctx, state)
    }
    return nil, nil // 승리조건 없는 장르 (예: 자유 탐색)
}
```

> Plugin 에러는 기존 `apperror.AppError` (RFC 9457 Problem Details)를 사용합니다.

### EventProcessor Chain

```go
type EventProcessor interface {
    Process(ctx context.Context, event GameEvent, state GameState) (GameState, error)
    SetNext(next EventProcessor) EventProcessor
}
```

체인: `AuthValidator → SessionValidator → PhaseValidator → GenreValidator → GenreProcessor → WinChecker → PostProcessor`

각 단계는 Plugin의 optional interface를 type assertion으로 확인:
```go
func (p *GenreProcessor) Process(ctx context.Context, event GameEvent, state GameState) (GameState, error) {
    if h, ok := p.plugin.(GameEventHandler); ok {
        if err := h.Validate(ctx, event, state); err != nil {
            return state, err
        }
        return h.Apply(ctx, event, state)
    }
    return state, nil // 이벤트 처리 불필요한 장르
}
```

---

## Audit Log (Event Sourcing 간소화)

> Review 피드백 반영: Full Event Store 대신 Audit Log + Redis Hot State 방식.
> 복잡도를 대폭 감소하면서 디버깅/복구에 필요한 기능만 유지.

### PostgreSQL (감사 로그 — append only)

```sql
-- 게임 이벤트 로그 (INSERT only, 읽기는 디버깅/복구 시에만)
CREATE TABLE game_audit_log (
    id          BIGSERIAL PRIMARY KEY,
    session_id  UUID NOT NULL,
    event_type  VARCHAR(100) NOT NULL,
    data        JSONB NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_session ON game_audit_log (session_id, created_at);

-- 스냅샷 (Redis → PG, 주기적)
CREATE TABLE game_snapshots (
    id           BIGSERIAL PRIMARY KEY,
    session_id   UUID NOT NULL,
    state        JSONB NOT NULL,
    plugin_state JSONB,
    is_critical  BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_snapshots_session ON game_snapshots (session_id, created_at DESC);
```

### Redis (Hot State — source of truth for runtime)

```
session:{id}:state        → JSON (현재 게임 상태) [24h TTL]
session:{id}:players      → HASH [24h TTL]
session:{id}:phase        → STRING [24h TTL]
session:{id}:timer        → STRING [24h TTL]
session:{id}:clues        → HASH [24h TTL]
session:{id}:lock         → STRING (분산 락, TTL 30s)
theme:{id}:schema         → JSON (캐시, 1h TTL)
```

### 상태 흐름

```
[런타임]
Redis (hot state) ← Session Actor ← WS messages
    ↓ (비동기, 5s 간격 + critical 즉시)
PG game_audit_log (감사) + game_snapshots (복구용)

[복구]
PG game_snapshots (최신) → Redis 복원 → Session 재시작
```

---

## 재접속 시 타이머 동작

```go
// TimerPolicy — 페이즈별 타이머 정책 (ConfigSchema에서 정의)
type TimerPolicy string
const (
    TimerContinue   TimerPolicy = "continue"   // 기본: 계속 진행
    TimerPause      TimerPolicy = "pause"      // 정지: 모든 플레이어 재접속 시 재개
    TimerExtend     TimerPolicy = "extend"     // 연장: N초 추가
)
```

- 기본값: `continue` (타이머 멈추지 않음 — 실서비스 기준)
- 페이즈 ConfigSchema에서 `timerPolicy` 설정 가능
- `pause` 모드: 마지막 플레이어 퇴장 시 타이머 일시정지, 재접속 시 재개

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
