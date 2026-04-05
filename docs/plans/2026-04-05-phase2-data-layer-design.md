# Phase 2: 데이터 레이어 설계

> 2026-04-05 승인. Phase 1 스캐폴딩 완료 후 진행.

## 범위

핵심 도메인 8 테이블 (users, themes, theme_characters, rooms, room_players, game_sessions, session_players, session_events). 소셜/결제/통계는 해당 Phase에서 마이그레이션 추가.

## 결정 사항

| 항목 | 결정 | 이유 |
|------|------|------|
| 스키마 범위 | 핵심 도메인만 (~8 테이블) | 소셜/결제는 변경 가능성 높아 해당 Phase에서 추가 |
| 마이그레이션 형식 | SQL 파일 (goose) | DDL은 순수 SQL이 가독성/리뷰 최적 |
| Redis 구조 | 인터페이스 분리 (cache/lock) | 설계 문서 cache.Provider 패턴 준수, 관심사 분리 |
| sqlc 쿼리 구조 | 도메인별 분리 | 29모듈 + REST 도메인 고려, 초기부터 분리 |
| pubsub | Phase 4에서 추가 | WebSocket 인프라와 함께 구현 |

## 디렉토리 구조

```
apps/server/
├── db/
│   ├── migrations/          # goose SQL 마이그레이션
│   │   ├── 00001_init_extensions.sql
│   │   ├── 00002_users.sql
│   │   ├── 00003_themes.sql
│   │   ├── 00004_rooms.sql
│   │   └── 00005_sessions.sql
│   ├── queries/             # sqlc 쿼리 (도메인별)
│   │   ├── users.sql
│   │   ├── themes.sql
│   │   ├── rooms.sql
│   │   └── sessions.sql
│   └── sqlc.yaml
├── internal/
│   ├── db/                  # sqlc 생성 코드 (자동)
│   ├── infra/
│   │   ├── postgres/        # pgxpool 연결 관리
│   │   │   └── postgres.go
│   │   ├── cache/           # cache.Provider + Redis 구현
│   │   │   ├── provider.go
│   │   │   └── redis.go
│   │   └── lock/            # lock.Locker + Redis 구현
│   │       ├── locker.go
│   │       └── redis.go
```

## DB 스키마

### 00001: Extensions
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### 00002: Users
```sql
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nickname    VARCHAR(30) NOT NULL,
    email       VARCHAR(255) UNIQUE,
    avatar_url  TEXT,
    role        VARCHAR(20) NOT NULL DEFAULT 'USER',
    provider    VARCHAR(20) NOT NULL,
    provider_id VARCHAR(255) NOT NULL,
    coin_balance BIGINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(provider, provider_id)
);
```

### 00003: Themes
```sql
CREATE TABLE themes (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id    UUID NOT NULL REFERENCES users(id),
    title         VARCHAR(100) NOT NULL,
    slug          VARCHAR(100) UNIQUE NOT NULL,
    description   TEXT,
    cover_image   TEXT,
    min_players   INT NOT NULL DEFAULT 4,
    max_players   INT NOT NULL DEFAULT 8,
    duration_min  INT NOT NULL DEFAULT 60,
    price         INT NOT NULL DEFAULT 0,
    status        VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    config_json   JSONB NOT NULL DEFAULT '{}',
    version       INT NOT NULL DEFAULT 1,
    published_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE theme_characters (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    theme_id    UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
    name        VARCHAR(50) NOT NULL,
    description TEXT,
    image_url   TEXT,
    is_culprit  BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order  INT NOT NULL DEFAULT 0
);
```

### 00004: Rooms
```sql
CREATE TABLE rooms (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    theme_id    UUID NOT NULL REFERENCES themes(id),
    host_id     UUID NOT NULL REFERENCES users(id),
    code        VARCHAR(6) UNIQUE NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'WAITING',
    max_players INT NOT NULL,
    is_private  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE room_players (
    room_id      UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id),
    character_id UUID REFERENCES theme_characters(id),
    is_ready     BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (room_id, user_id)
);
```

### 00005: Game Sessions
```sql
CREATE TABLE game_sessions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id       UUID NOT NULL REFERENCES rooms(id),
    theme_id      UUID NOT NULL REFERENCES themes(id),
    current_phase VARCHAR(50) NOT NULL DEFAULT '',
    phase_index   INT NOT NULL DEFAULT 0,
    state_json    JSONB NOT NULL DEFAULT '{}',
    started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at      TIMESTAMPTZ
);

CREATE TABLE session_players (
    session_id   UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id),
    character_id UUID NOT NULL REFERENCES theme_characters(id),
    score        INT NOT NULL DEFAULT 0,
    is_alive     BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (session_id, user_id)
);

CREATE TABLE session_events (
    id          BIGSERIAL PRIMARY KEY,
    session_id  UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    type        VARCHAR(50) NOT NULL,
    payload     JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_session_events_session ON session_events(session_id, id);
```

## sqlc 설정

```yaml
version: "2"
sql:
  - engine: "postgresql"
    queries: "queries/"
    schema: "migrations/"
    gen:
      go:
        package: "db"
        out: "../internal/db"
        sql_package: "pgx/v5"
        emit_json_tags: true
        emit_empty_slices: true
        overrides:
          - db_type: "uuid"
            go_type: "github.com/google/uuid.UUID"
          - db_type: "timestamptz"
            go_type: "time.Time"
          - db_type: "jsonb"
            go_type: "json.RawMessage"
            import: "encoding/json"
```

## Redis 레이어

### cache.Provider
```go
type Provider interface {
    Get(ctx context.Context, key string) ([]byte, error)
    Set(ctx context.Context, key string, value []byte, ttl time.Duration) error
    Del(ctx context.Context, keys ...string) error
    Exists(ctx context.Context, key string) (bool, error)
}
```

### lock.Locker
```go
type Locker interface {
    Acquire(ctx context.Context, key string, ttl time.Duration) (Lock, error)
}
type Lock interface {
    Release(ctx context.Context) error
}
```

Redis 구현: go-redis/v9, 분산 락은 SET NX + Lua 스크립트 릴리스.

## 의존성

- `github.com/jackc/pgx/v5` — PostgreSQL 드라이버
- `github.com/google/uuid` — UUID 타입
- `github.com/pressly/goose/v3` — 마이그레이션
- `github.com/redis/go-redis/v9` — Redis 클라이언트
- `github.com/sqlc-dev/sqlc` — CLI (로컬 설치)

## PostgreSQL 연결

`internal/infra/postgres/postgres.go` — pgxpool.Pool 생성 + 헬스체크. main.go에서 DI 주입.
