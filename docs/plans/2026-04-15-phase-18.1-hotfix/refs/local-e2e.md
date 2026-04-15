# Local E2E: Real-Backend Smoke Test Guide

Phase 18.1 PR-4 — `game-session-live.spec.ts`

## Prerequisites

- Docker + docker-compose installed
- Node.js 20+ and pnpm 9+
- Go 1.25+ (for server binary)

## 1. Start the backend stack

```bash
# From project root
GAME_RUNTIME_V2=true docker-compose -f docker-compose.dev.yml up -d postgres redis
```

Wait for Postgres to be ready (about 5 seconds), then run migrations:

```bash
cd apps/server
go run ./cmd/migrate/main.go
```

Start the server with the feature flag enabled:

```bash
GAME_RUNTIME_V2=true go run ./cmd/server/main.go
# Server listens on :8080
```

## 2. Start the frontend dev server

```bash
# From project root
pnpm --filter web dev
# Frontend listens on :3000
```

## 3. Seed a test account (first run only)

```bash
# Register e2e@test.com / e2etest1234 via the API
curl -s -X POST http://localhost:8080/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"e2e@test.com","password":"e2etest1234","nickname":"E2ETester"}'
```

## 4. Run the smoke tests

```bash
cd apps/web

# Required env var enables the skip guard
PLAYWRIGHT_BACKEND=true pnpm exec playwright test e2e/game-session-live.spec.ts \
  --headed
```

To run headless (CI-style):

```bash
PLAYWRIGHT_BACKEND=true pnpm exec playwright test e2e/game-session-live.spec.ts
```

## 5. Expected results

| Test | Expected outcome |
|------|-----------------|
| 로그인 → 방 생성 → flag 활성 | PASS — room URL matches `/room/` |
| StartRoom API with flag | 200 (v2 enabled) or 503 (flag off) |
| 게임 시작 버튼 표시 | PASS — button visible for host |
| 게임 시작 → 페이즈 진행 | GamePage URL or 503 error UI |

## 6. Without PLAYWRIGHT_BACKEND set

All tests in `game-session-live.spec.ts` are skipped automatically:

```
✓  [skip] PLAYWRIGHT_BACKEND not set — requires local backend
```

This ensures the file is safe to include in CI without a real backend.

## 7. Teardown

```bash
docker-compose -f docker-compose.dev.yml down -v
```
