# Phase 2: 데이터 레이어 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Go 서버에 PostgreSQL(pgx+sqlc+goose) + Redis(cache/lock) 데이터 레이어 구축

**Architecture:** infra/ 패키지에 postgres/redis 연결 관리, cache.Provider + lock.Locker 인터페이스 분리, goose SQL 마이그레이션 5개, sqlc 도메인별 쿼리 4개, health 엔드포인트에 DB/Redis 체크 통합

**Tech Stack:** pgx/v5, google/uuid, goose/v3, go-redis/v9, sqlc CLI

---

### Task 1: Go 의존성 추가

**Files:**
- Modify: `apps/server/go.mod`

**Step 1: 의존성 설치**

Run:
```bash
cd apps/server && go get github.com/jackc/pgx/v5 github.com/google/uuid github.com/pressly/goose/v3 github.com/redis/go-redis/v9
```

**Step 2: go mod tidy**

Run:
```bash
cd apps/server && go mod tidy
```

**Step 3: 빌드 확인**

Run:
```bash
cd apps/server && go build ./...
```
Expected: 에러 없이 빌드 성공

**Step 4: 커밋**

```bash
git add apps/server/go.mod apps/server/go.sum
git commit -m "chore: add pgx, uuid, goose, go-redis dependencies"
```

---

### Task 2: PostgreSQL 연결 풀

**Files:**
- Create: `apps/server/internal/infra/postgres/postgres.go`
- Test: `apps/server/internal/infra/postgres/postgres_test.go`

**Step 1: 테스트 작성**

```go
// apps/server/internal/infra/postgres/postgres_test.go
package postgres

import (
	"testing"
)

func TestNew_InvalidURL(t *testing.T) {
	_, err := New("not-a-valid-url")
	if err == nil {
		t.Fatal("expected error for invalid URL")
	}
}

func TestNew_EmptyURL(t *testing.T) {
	_, err := New("")
	if err == nil {
		t.Fatal("expected error for empty URL")
	}
}
```

**Step 2: 테스트 실패 확인**

Run: `cd apps/server && go test ./internal/infra/postgres/ -v`
Expected: FAIL — `New` 미정의

**Step 3: 구현**

```go
// apps/server/internal/infra/postgres/postgres.go
package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	defaultMaxConns     = 25
	defaultMinConns     = 5
	defaultMaxConnLife  = 30 * time.Minute
	defaultMaxConnIdle  = 5 * time.Minute
	defaultHealthCheck  = 30 * time.Second
	defaultConnTimeout  = 5 * time.Second
)

// New creates a pgxpool.Pool from the given database URL.
// The caller is responsible for calling pool.Close() when done.
func New(databaseURL string) (*pgxpool.Pool, error) {
	if databaseURL == "" {
		return nil, fmt.Errorf("postgres: database URL is empty")
	}

	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("postgres: parse config: %w", err)
	}

	cfg.MaxConns = defaultMaxConns
	cfg.MinConns = defaultMinConns
	cfg.MaxConnLifetime = defaultMaxConnLife
	cfg.MaxConnIdleTime = defaultMaxConnIdle
	cfg.HealthCheckPeriod = defaultHealthCheck

	ctx, cancel := context.WithTimeout(context.Background(), defaultConnTimeout)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("postgres: connect: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("postgres: ping: %w", err)
	}

	return pool, nil
}
```

**Step 4: 테스트 통과 확인**

Run: `cd apps/server && go test ./internal/infra/postgres/ -v`
Expected: PASS (invalid/empty URL 테스트 통과)

**Step 5: 커밋**

```bash
git add apps/server/internal/infra/postgres/
git commit -m "feat: add PostgreSQL connection pool with pgxpool"
```

---

### Task 3: Redis 연결 + cache.Provider

**Files:**
- Create: `apps/server/internal/infra/cache/provider.go`
- Create: `apps/server/internal/infra/cache/redis.go`
- Test: `apps/server/internal/infra/cache/redis_test.go`

**Step 1: Provider 인터페이스 작성**

```go
// apps/server/internal/infra/cache/provider.go
package cache

import (
	"context"
	"errors"
	"time"
)

// ErrNotFound is returned when a key does not exist in the cache.
var ErrNotFound = errors.New("cache: key not found")

// Provider defines the interface for cache operations.
type Provider interface {
	Get(ctx context.Context, key string) ([]byte, error)
	Set(ctx context.Context, key string, value []byte, ttl time.Duration) error
	Del(ctx context.Context, keys ...string) error
	Exists(ctx context.Context, key string) (bool, error)
	Ping(ctx context.Context) error
	Close() error
}
```

**Step 2: 테스트 작성**

```go
// apps/server/internal/infra/cache/redis_test.go
package cache

import (
	"testing"
)

func TestNewRedis_InvalidURL(t *testing.T) {
	_, err := NewRedis("not-a-valid-url")
	if err == nil {
		t.Fatal("expected error for invalid URL")
	}
}

func TestNewRedis_EmptyURL(t *testing.T) {
	_, err := NewRedis("")
	if err == nil {
		t.Fatal("expected error for empty URL")
	}
}
```

**Step 3: 테스트 실패 확인**

Run: `cd apps/server && go test ./internal/infra/cache/ -v`
Expected: FAIL — `NewRedis` 미정의

**Step 4: Redis 구현**

```go
// apps/server/internal/infra/cache/redis.go
package cache

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const defaultConnTimeout = 5 * time.Second

// RedisCache implements Provider using go-redis.
type RedisCache struct {
	client *redis.Client
}

// NewRedis creates a new Redis-backed cache Provider.
func NewRedis(redisURL string) (*RedisCache, error) {
	if redisURL == "" {
		return nil, fmt.Errorf("cache: redis URL is empty")
	}

	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("cache: parse redis URL: %w", err)
	}

	client := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), defaultConnTimeout)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("cache: redis ping: %w", err)
	}

	return &RedisCache{client: client}, nil
}

// Client returns the underlying redis.Client for shared use (e.g., lock).
func (r *RedisCache) Client() *redis.Client {
	return r.client
}

func (r *RedisCache) Get(ctx context.Context, key string) ([]byte, error) {
	val, err := r.client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("cache: get %q: %w", key, err)
	}
	return val, nil
}

func (r *RedisCache) Set(ctx context.Context, key string, value []byte, ttl time.Duration) error {
	if err := r.client.Set(ctx, key, value, ttl).Err(); err != nil {
		return fmt.Errorf("cache: set %q: %w", key, err)
	}
	return nil
}

func (r *RedisCache) Del(ctx context.Context, keys ...string) error {
	if err := r.client.Del(ctx, keys...).Err(); err != nil {
		return fmt.Errorf("cache: del: %w", err)
	}
	return nil
}

func (r *RedisCache) Exists(ctx context.Context, key string) (bool, error) {
	n, err := r.client.Exists(ctx, key).Result()
	if err != nil {
		return false, fmt.Errorf("cache: exists %q: %w", key, err)
	}
	return n > 0, nil
}

func (r *RedisCache) Ping(ctx context.Context) error {
	return r.client.Ping(ctx).Err()
}

func (r *RedisCache) Close() error {
	return r.client.Close()
}
```

**Step 5: 테스트 통과 확인**

Run: `cd apps/server && go test ./internal/infra/cache/ -v`
Expected: PASS

**Step 6: 커밋**

```bash
git add apps/server/internal/infra/cache/
git commit -m "feat: add cache.Provider interface with Redis implementation"
```

---

### Task 4: lock.Locker (분산 락)

**Files:**
- Create: `apps/server/internal/infra/lock/locker.go`
- Create: `apps/server/internal/infra/lock/redis.go`
- Test: `apps/server/internal/infra/lock/redis_test.go`

**Step 1: Locker 인터페이스 작성**

```go
// apps/server/internal/infra/lock/locker.go
package lock

import (
	"context"
	"errors"
	"time"
)

// ErrLockNotAcquired is returned when a lock cannot be obtained.
var ErrLockNotAcquired = errors.New("lock: not acquired")

// Lock represents an acquired distributed lock.
type Lock interface {
	Release(ctx context.Context) error
}

// Locker defines the interface for distributed locking.
type Locker interface {
	Acquire(ctx context.Context, key string, ttl time.Duration) (Lock, error)
}
```

**Step 2: 테스트 작성**

```go
// apps/server/internal/infra/lock/redis_test.go
package lock

import (
	"testing"
)

func TestNewRedisLocker_NilClient(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("expected panic for nil client")
		}
	}()
	NewRedisLocker(nil)
}
```

**Step 3: 테스트 실패 확인**

Run: `cd apps/server && go test ./internal/infra/lock/ -v`
Expected: FAIL

**Step 4: Redis Locker 구현 (SET NX + Lua release)**

```go
// apps/server/internal/infra/lock/redis.go
package lock

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

const lockPrefix = "lock:"

// releaseScript atomically checks owner before deleting.
var releaseScript = redis.NewScript(`
if redis.call("get", KEYS[1]) == ARGV[1] then
	return redis.call("del", KEYS[1])
end
return 0
`)

// RedisLocker implements Locker using Redis SET NX.
type RedisLocker struct {
	client *redis.Client
}

// NewRedisLocker creates a new RedisLocker. Panics if client is nil.
func NewRedisLocker(client *redis.Client) *RedisLocker {
	if client == nil {
		panic("lock: redis client must not be nil")
	}
	return &RedisLocker{client: client}
}

func (l *RedisLocker) Acquire(ctx context.Context, key string, ttl time.Duration) (Lock, error) {
	token := uuid.New().String()
	fullKey := lockPrefix + key

	ok, err := l.client.SetNX(ctx, fullKey, token, ttl).Result()
	if err != nil {
		return nil, fmt.Errorf("lock: acquire %q: %w", key, err)
	}
	if !ok {
		return nil, ErrLockNotAcquired
	}

	return &redisLock{
		client: l.client,
		key:    fullKey,
		token:  token,
	}, nil
}

type redisLock struct {
	client *redis.Client
	key    string
	token  string
}

func (rl *redisLock) Release(ctx context.Context) error {
	result, err := releaseScript.Run(ctx, rl.client, []string{rl.key}, rl.token).Int64()
	if err != nil {
		return fmt.Errorf("lock: release %q: %w", rl.key, err)
	}
	if result == 0 {
		return fmt.Errorf("lock: release %q: lock expired or owned by another", rl.key)
	}
	return nil
}
```

**Step 5: 테스트 통과 확인**

Run: `cd apps/server && go test ./internal/infra/lock/ -v`
Expected: PASS

**Step 6: 커밋**

```bash
git add apps/server/internal/infra/lock/
git commit -m "feat: add lock.Locker interface with Redis SET NX implementation"
```

---

### Task 5: goose 마이그레이션 (5 SQL 파일)

**Files:**
- Create: `apps/server/db/migrations/00001_init_extensions.sql`
- Create: `apps/server/db/migrations/00002_users.sql`
- Create: `apps/server/db/migrations/00003_themes.sql`
- Create: `apps/server/db/migrations/00004_rooms.sql`
- Create: `apps/server/db/migrations/00005_sessions.sql`

**Step 1: 마이그레이션 파일 5개 생성**

`00001_init_extensions.sql`:
```sql
-- +goose Up
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- +goose Down
DROP EXTENSION IF EXISTS "pgcrypto";
DROP EXTENSION IF EXISTS "uuid-ossp";
```

`00002_users.sql`:
```sql
-- +goose Up
CREATE TABLE users (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nickname     VARCHAR(30) NOT NULL,
    email        VARCHAR(255) UNIQUE,
    avatar_url   TEXT,
    role         VARCHAR(20) NOT NULL DEFAULT 'USER',
    provider     VARCHAR(20) NOT NULL,
    provider_id  VARCHAR(255) NOT NULL,
    coin_balance BIGINT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(provider, provider_id)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_provider ON users(provider, provider_id);

-- +goose Down
DROP TABLE IF EXISTS users;
```

`00003_themes.sql`:
```sql
-- +goose Up
CREATE TABLE themes (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id   UUID NOT NULL REFERENCES users(id),
    title        VARCHAR(100) NOT NULL,
    slug         VARCHAR(100) UNIQUE NOT NULL,
    description  TEXT,
    cover_image  TEXT,
    min_players  INT NOT NULL DEFAULT 4,
    max_players  INT NOT NULL DEFAULT 8,
    duration_min INT NOT NULL DEFAULT 60,
    price        INT NOT NULL DEFAULT 0,
    status       VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    config_json  JSONB NOT NULL DEFAULT '{}',
    version      INT NOT NULL DEFAULT 1,
    published_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_themes_creator ON themes(creator_id);
CREATE INDEX idx_themes_status ON themes(status);
CREATE INDEX idx_themes_slug ON themes(slug);

CREATE TABLE theme_characters (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    theme_id    UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
    name        VARCHAR(50) NOT NULL,
    description TEXT,
    image_url   TEXT,
    is_culprit  BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order  INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_theme_characters_theme ON theme_characters(theme_id);

-- +goose Down
DROP TABLE IF EXISTS theme_characters;
DROP TABLE IF EXISTS themes;
```

`00004_rooms.sql`:
```sql
-- +goose Up
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

CREATE INDEX idx_rooms_code ON rooms(code);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_rooms_host ON rooms(host_id);

CREATE TABLE room_players (
    room_id      UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id),
    character_id UUID REFERENCES theme_characters(id),
    is_ready     BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (room_id, user_id)
);

-- +goose Down
DROP TABLE IF EXISTS room_players;
DROP TABLE IF EXISTS rooms;
```

`00005_sessions.sql`:
```sql
-- +goose Up
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

CREATE INDEX idx_sessions_room ON game_sessions(room_id);

CREATE TABLE session_players (
    session_id   UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id),
    character_id UUID NOT NULL REFERENCES theme_characters(id),
    score        INT NOT NULL DEFAULT 0,
    is_alive     BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (session_id, user_id)
);

CREATE TABLE session_events (
    id         BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    type       VARCHAR(50) NOT NULL,
    payload    JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_events_session ON session_events(session_id, id);

-- +goose Down
DROP TABLE IF EXISTS session_events;
DROP TABLE IF EXISTS session_players;
DROP TABLE IF EXISTS game_sessions;
```

**Step 2: Docker DB 기동 + 마이그레이션 실행 확인**

Run:
```bash
docker compose up -d postgres
go install github.com/pressly/goose/v3/cmd/goose@latest
cd apps/server && goose -dir db/migrations postgres "postgres://mmp:mmp_dev@localhost:5432/mmf?sslmode=disable" up
```
Expected: 5개 마이그레이션 적용 성공

**Step 3: Down 마이그레이션 확인**

Run:
```bash
cd apps/server && goose -dir db/migrations postgres "postgres://mmp:mmp_dev@localhost:5432/mmf?sslmode=disable" down-to 0
```
Expected: 모든 테이블 롤백

**Step 4: 다시 Up 적용**

Run:
```bash
cd apps/server && goose -dir db/migrations postgres "postgres://mmp:mmp_dev@localhost:5432/mmf?sslmode=disable" up
```

**Step 5: 커밋**

```bash
git add apps/server/db/migrations/
git commit -m "feat: add goose SQL migrations for core domain (8 tables)"
```

---

### Task 6: sqlc 설정 + 쿼리

**Files:**
- Create: `apps/server/db/sqlc.yaml`
- Create: `apps/server/db/queries/users.sql`
- Create: `apps/server/db/queries/themes.sql`
- Create: `apps/server/db/queries/rooms.sql`
- Create: `apps/server/db/queries/sessions.sql`
- Generate: `apps/server/internal/db/` (자동 생성)

**Step 1: sqlc CLI 설치 확인**

Run:
```bash
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
sqlc version
```

**Step 2: sqlc.yaml 생성**

```yaml
# apps/server/db/sqlc.yaml
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

**Step 3: 쿼리 파일 작성**

`queries/users.sql`:
```sql
-- name: GetUser :one
SELECT * FROM users WHERE id = $1;

-- name: GetUserByProvider :one
SELECT * FROM users WHERE provider = $1 AND provider_id = $2;

-- name: CreateUser :one
INSERT INTO users (nickname, email, avatar_url, role, provider, provider_id)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: UpdateUser :one
UPDATE users SET nickname = $2, avatar_url = $3, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateCoinBalance :one
UPDATE users SET coin_balance = coin_balance + $2, updated_at = NOW()
WHERE id = $1
RETURNING *;
```

`queries/themes.sql`:
```sql
-- name: GetTheme :one
SELECT * FROM themes WHERE id = $1;

-- name: GetThemeBySlug :one
SELECT * FROM themes WHERE slug = $1;

-- name: ListThemesByCreator :many
SELECT * FROM themes WHERE creator_id = $1 ORDER BY created_at DESC;

-- name: ListPublishedThemes :many
SELECT * FROM themes WHERE status = 'PUBLISHED' ORDER BY published_at DESC LIMIT $1 OFFSET $2;

-- name: CreateTheme :one
INSERT INTO themes (creator_id, title, slug, description, cover_image, min_players, max_players, duration_min, price, config_json)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: UpdateThemeStatus :one
UPDATE themes SET status = $2, published_at = CASE WHEN $2 = 'PUBLISHED' THEN NOW() ELSE published_at END, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: GetThemeCharacters :many
SELECT * FROM theme_characters WHERE theme_id = $1 ORDER BY sort_order;

-- name: CreateThemeCharacter :one
INSERT INTO theme_characters (theme_id, name, description, image_url, is_culprit, sort_order)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;
```

`queries/rooms.sql`:
```sql
-- name: GetRoom :one
SELECT * FROM rooms WHERE id = $1;

-- name: GetRoomByCode :one
SELECT * FROM rooms WHERE code = $1;

-- name: ListWaitingRooms :many
SELECT * FROM rooms WHERE status = 'WAITING' AND is_private = FALSE ORDER BY created_at DESC LIMIT $1 OFFSET $2;

-- name: CreateRoom :one
INSERT INTO rooms (theme_id, host_id, code, max_players, is_private)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateRoomStatus :exec
UPDATE rooms SET status = $2, updated_at = NOW() WHERE id = $1;

-- name: GetRoomPlayers :many
SELECT * FROM room_players WHERE room_id = $1;

-- name: AddRoomPlayer :exec
INSERT INTO room_players (room_id, user_id) VALUES ($1, $2);

-- name: RemoveRoomPlayer :exec
DELETE FROM room_players WHERE room_id = $1 AND user_id = $2;

-- name: SetPlayerReady :exec
UPDATE room_players SET is_ready = $3 WHERE room_id = $1 AND user_id = $2;
```

`queries/sessions.sql`:
```sql
-- name: GetSession :one
SELECT * FROM game_sessions WHERE id = $1;

-- name: CreateSession :one
INSERT INTO game_sessions (room_id, theme_id) RETURNING *;

-- name: UpdateSessionPhase :exec
UPDATE game_sessions SET current_phase = $2, phase_index = $3, updated_at = NOW() WHERE id = $1;

-- name: UpdateSessionState :exec
UPDATE game_sessions SET state_json = $2 WHERE id = $1;

-- name: EndSession :exec
UPDATE game_sessions SET ended_at = NOW() WHERE id = $1;

-- name: GetSessionPlayers :many
SELECT * FROM session_players WHERE session_id = $1;

-- name: AddSessionPlayer :exec
INSERT INTO session_players (session_id, user_id, character_id) VALUES ($1, $2, $3);

-- name: UpdatePlayerScore :exec
UPDATE session_players SET score = score + $3 WHERE session_id = $1 AND user_id = $2;

-- name: SetPlayerAlive :exec
UPDATE session_players SET is_alive = $3 WHERE session_id = $1 AND user_id = $2;

-- name: AddSessionEvent :one
INSERT INTO session_events (session_id, type, payload) VALUES ($1, $2, $3) RETURNING *;

-- name: GetSessionEvents :many
SELECT * FROM session_events WHERE session_id = $1 ORDER BY id;
```

**Step 4: sqlc generate 실행**

Run:
```bash
cd apps/server/db && sqlc generate
```
Expected: `internal/db/` 디렉토리에 Go 파일 생성

**Step 5: 빌드 확인**

Run: `cd apps/server && go build ./...`
Expected: 에러 없이 빌드 성공

**Step 6: 커밋**

```bash
git add apps/server/db/sqlc.yaml apps/server/db/queries/ apps/server/internal/db/
git commit -m "feat: add sqlc config and domain queries (users, themes, rooms, sessions)"
```

---

### Task 7: Health 핸들러 업데이트 (DB + Redis 체크)

**Files:**
- Modify: `apps/server/internal/health/handler.go`
- Modify: `apps/server/internal/health/handler_test.go`

**Step 1: 테스트 업데이트**

```go
// handler_test.go에 추가
func TestReady_WithCheckers(t *testing.T) {
	// healthy checker
	h := NewHandler(func(ctx context.Context) error { return nil })
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ready", nil)
	h.Ready(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
}

func TestReady_UnhealthyChecker(t *testing.T) {
	h := NewHandler(func(ctx context.Context) error {
		return fmt.Errorf("db down")
	})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ready", nil)
	h.Ready(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", rec.Code)
	}
}
```

**Step 2: Handler 리팩토링**

```go
// handler.go
package health

import (
	"context"
	"encoding/json"
	"net/http"
)

type CheckFunc func(ctx context.Context) error

type response struct {
	Status string `json:"status"`
}

type Handler struct {
	checkers []CheckFunc
}

func NewHandler(checkers ...CheckFunc) *Handler {
	return &Handler{checkers: checkers}
}

func (h *Handler) Health(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(response{Status: "ok"})
}

func (h *Handler) Ready(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	for _, check := range h.checkers {
		if err := check(r.Context()); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(response{Status: "unavailable"})
			return
		}
	}

	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(response{Status: "ready"})
}
```

**Step 3: 기존 테스트 수정 (NewHandler 시그니처 변경)**

기존 `TestHealth_ReturnsOK`와 `TestReady_ReturnsOK`에서 `NewHandler()` 호출 유지 (가변 인자라 호환).

**Step 4: 테스트 통과 확인**

Run: `cd apps/server && go test ./internal/health/ -v`
Expected: PASS

**Step 5: 커밋**

```bash
git add apps/server/internal/health/
git commit -m "feat: add health check functions for DB and Redis readiness"
```

---

### Task 8: main.go DI 통합

**Files:**
- Modify: `apps/server/cmd/server/main.go`

**Step 1: main.go 업데이트**

```go
// main.go — 기존 코드에 추가:

// 2.5. PostgreSQL
pool, err := postgres.New(cfg.DatabaseURL)
if err != nil {
    logger.Fatal().Err(err).Msg("failed to connect to postgres")
}
defer pool.Close()
logger.Info().Msg("postgres connected")

// 2.6. Redis (cache + lock)
redisCache, err := cache.NewRedis(cfg.RedisURL)
if err != nil {
    logger.Fatal().Err(err).Msg("failed to connect to redis")
}
defer redisCache.Close()
logger.Info().Msg("redis connected")

locker := lock.NewRedisLocker(redisCache.Client())

// 2.7. sqlc Queries
queries := db.New(pool)
```

`_ = queries` 와 `_ = locker` 로 미사용 방지 (Phase 3에서 서비스에 주입).

Health 핸들러 변경:
```go
healthHandler := health.NewHandler(
    pool.Ping,
    func(ctx context.Context) error { return redisCache.Ping(ctx) },
)
```

**Step 2: 빌드 확인**

Run: `cd apps/server && go build ./cmd/server/`
Expected: 에러 없이 빌드 성공

**Step 3: 전체 테스트**

Run: `cd apps/server && go test -race ./...`
Expected: ALL PASS

**Step 4: 커밋**

```bash
git add apps/server/cmd/server/main.go
git commit -m "feat: wire PostgreSQL, Redis, and sqlc into main.go DI"
```

---

### Task 9: Taskfile 업데이트 (마이그레이션 태스크)

**Files:**
- Modify: `Taskfile.yml`

**Step 1: 마이그레이션 태스크 추가**

```yaml
  # ─── Database ────────────────────────────────────────
  db:migrate:
    desc: Run database migrations
    dir: "{{.GO_SRC}}"
    cmds:
      - goose -dir db/migrations postgres "${DATABASE_URL:-postgres://mmp:mmp_dev@localhost:5432/mmf?sslmode=disable}" up

  db:migrate:down:
    desc: Rollback last database migration
    dir: "{{.GO_SRC}}"
    cmds:
      - goose -dir db/migrations postgres "${DATABASE_URL:-postgres://mmp:mmp_dev@localhost:5432/mmf?sslmode=disable}" down

  db:migrate:status:
    desc: Show migration status
    dir: "{{.GO_SRC}}"
    cmds:
      - goose -dir db/migrations postgres "${DATABASE_URL:-postgres://mmp:mmp_dev@localhost:5432/mmf?sslmode=disable}" status

  db:sqlc:
    desc: Generate sqlc code
    dir: "{{.GO_SRC}}/db"
    cmds:
      - sqlc generate
```

`go:generate` 태스크의 sqlc 줄을 `task: db:sqlc`로 변경.

**Step 2: 커밋**

```bash
git add Taskfile.yml
git commit -m "chore: add database migration and sqlc tasks to Taskfile"
```

---

### Task 10: 통합 검증

**Step 1: 전체 Docker 기동**

Run: `docker compose up -d`

**Step 2: 마이그레이션 실행**

Run: `task db:migrate`
Expected: 5개 마이그레이션 성공

**Step 3: 서버 빌드 + 실행**

Run:
```bash
cd apps/server && DATABASE_URL="postgres://mmp:mmp_dev@localhost:5432/mmf?sslmode=disable" REDIS_URL="redis://localhost:6379" go run ./cmd/server/
```

**Step 4: Health/Ready 엔드포인트 확인**

Run:
```bash
curl localhost:8080/health  # {"status":"ok"}
curl localhost:8080/ready   # {"status":"ready"}  (DB+Redis 연결 정상)
```

**Step 5: 전체 테스트 스위트**

Run: `cd apps/server && go test -race -cover ./...`
Expected: ALL PASS, 75%+ 커버리지

**Step 6: 최종 커밋 (필요 시)**

```bash
git add -A
git commit -m "chore: Phase 2 data layer complete"
```
