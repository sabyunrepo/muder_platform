# 핵심 데이터 모델 + Event Store 스키마

> 부모: [../design.md](../design.md)

---

## PostgreSQL 스키마

### Audit Log (Event Sourcing 간소화)

> Review 피드백 반영: Full Event Store 대신 append-only audit log + Redis hot state.
> 복잡도를 대폭 감소하면서 디버깅/복구에 필요한 기능만 유지.

```sql
-- 게임 이벤트 감사 로그 (INSERT only, 읽기는 디버깅/복구 시에만)
CREATE TABLE game_audit_log (
    id          BIGSERIAL PRIMARY KEY,
    session_id  UUID NOT NULL,
    event_type  VARCHAR(100) NOT NULL,
    data        JSONB NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_session ON game_audit_log (session_id, created_at);
CREATE INDEX idx_audit_type ON game_audit_log (event_type, created_at);

-- 스냅샷 (Redis → PG, 주기적 5s 간격 + critical 즉시)
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

### Theme (에디터에서 제작)

```sql
CREATE TABLE themes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id   UUID NOT NULL REFERENCES users(id),
    genre       VARCHAR(50) NOT NULL,       -- crime_scene|script_kill|jubensha|murder_mystery
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    version     INT NOT NULL DEFAULT 1,
    schema_version VARCHAR(20) NOT NULL,    -- GenrePlugin 스키마 버전

    -- Plugin export (JSON)
    config      JSONB NOT NULL,             -- GenrePlugin.GetConfigSchema 기반 설정
    phases      JSONB NOT NULL,             -- 페이즈 정의
    rules       JSONB NOT NULL DEFAULT '{}',-- 규칙 (JSON Logic)
    clues       JSONB NOT NULL DEFAULT '[]',-- 단서 정의 (flat array, engine init 시 ClueGraph 빌드)
    clue_graph  JSONB NOT NULL DEFAULT '{}',-- 단서 의존성/조합 그래프 (nodes + edges)
    characters  JSONB NOT NULL DEFAULT '[]',-- 캐릭터 정의
    locations   JSONB NOT NULL DEFAULT '[]',-- 장소 정의

    -- 메타
    min_players INT NOT NULL DEFAULT 4,
    max_players INT NOT NULL DEFAULT 8,
    duration    INT,                       -- 예상 플레이시간(분)
    cover_image VARCHAR(500),

    status      VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft|published|archived
    published_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### Session

```sql
CREATE TABLE game_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_id    UUID NOT NULL REFERENCES themes(id),
    room_id     UUID NOT NULL REFERENCES rooms(id),
    host_id     UUID NOT NULL REFERENCES users(id),
    genre       VARCHAR(50) NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'waiting', -- waiting|playing|ended
    config      JSONB,                      -- 테마 설정 오버라이드
    result      JSONB,                      -- 결과 (승리팀/범인 등)
    started_at  TIMESTAMPTZ,
    ended_at    TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### Player

```sql
CREATE TABLE session_players (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES game_sessions(id),
    user_id     UUID NOT NULL REFERENCES users(id),
    character_id VARCHAR(100),
    role        VARCHAR(100),
    team        VARCHAR(50),
    status      VARCHAR(20) NOT NULL DEFAULT 'joined', -- joined|ready|playing|dead|left
    joined_at   TIMESTAMPTZ DEFAULT NOW(),
    left_at     TIMESTAMPTZ,
    UNIQUE (session_id, user_id)
);
```

---

## 이벤트 타입 전체

### 세션 라이프사이클
```
session.created      — 세션 생성
session.started      — 게임 시작
session.ended        — 게임 종료
session.aborted      — 비정상 종료
```

### 플레이어
```
player.joined        — 참가
player.left          — 퇴장
player.rejoined      — 재접속
player.ready         — 준비 완료
player.role_assigned — 역할 배정
player.status_changed — 상태 변경 (dead/alive 등)
```

### 페이즈
```
phase.entered        — 페이즈 진입
phase.exited         — 페이즈 퇴장
phase.skipped        — 페이즈 스킵
phase.timer_started  — 타이머 시작
phase.timer_expired  — 타이머 만료
phase.gm_override    — GM 오버라이드
```

### 단서
```
clue.distributed     — 단서 배포
clue.discovered      — 단서 발견
clue.combined        — 단서 조합
clue.revealed        — 단서 공개
clue.traded          — 단서 교환
clue.shown           — 단서 보여주기
clue.destroyed       — 단서 소모
```

### 의사결정
```
vote.casted          — 투표
vote.result          — 투표 결과
accusation.made      — 지목
accusation.result    — 지목 결과
consensus.reached    — 합의 도달
```

### 커뮤니케이션
```
chat.sent            — 채팅 전송
chat.muted           — 채팅 차단
group_chat.opened    — 밀담방 개설
group_chat.closed    — 밀담방 폐쇄
```

### 미디어
```
media.played         — 미디어 재생
bgm.changed          — BGM 변경
```

---

## GameState (Redis 핫 스테이트)

```go
type GameState struct {
    SessionID   uuid.UUID              `json:"sessionId"`
    PhaseID     string                 `json:"phaseId"`
    Round       int                    `json:"round"`
    Turn        int                    `json:"turn"`
    Timer       *TimerState            `json:"timer,omitempty"`
    Players     map[string]PlayerState `json:"players"`
    Clues       map[string]ClueState   `json:"clues"`
    Variables   map[string]any         `json:"variables"`
    PluginState json.RawMessage        `json:"pluginState"`  // 장르별 상태
}

type PlayerState struct {
    ID       string `json:"id"`
    UserID   string `json:"userId"`
    Role     string `json:"role,omitempty"`
    Team     string `json:"team,omitempty"`
    Status   string `json:"status"`  // joined|ready|playing|dead|left
    Location string `json:"location,omitempty"`
}

type ClueState struct {
    ClueID      string    `json:"clueId"`
    OwnerID     string    `json:"ownerId,omitempty"`
    Discovered  bool      `json:"discovered"`
    UsesLeft    *int      `json:"usesLeft,omitempty"`
    DiscoveredAt time.Time `json:"discoveredAt,omitempty"`
}

type TimerState struct {
    Duration  int  `json:"duration"`   // total seconds
    Remaining int  `json:"remaining"`  // seconds left
    Paused    bool `json:"paused"`
}
```
