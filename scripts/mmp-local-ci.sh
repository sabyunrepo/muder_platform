#!/usr/bin/env bash
# Run reusable local PR validation in Docker instead of spending GitHub Actions
# workers on every PR iteration.

set -euo pipefail

MODE="${1:-help}"
shift || true

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

COMPOSE_FILE="${MMP_LOCAL_CI_COMPOSE_FILE:-docker-compose.local-ci.yml}"
PROJECT_NAME="${MMP_LOCAL_CI_PROJECT:-mmp-local-ci}"
GIT_COMMON_DIR="$(git rev-parse --git-common-dir)"
GIT_COMMON_ABS="$(cd "$GIT_COMMON_DIR" && pwd -P)"
MARKER_DIR="$GIT_COMMON_DIR/mmp-local-ci"
MARKER_FILE="$MARKER_DIR/last-run.json"
HEAD_SHA="$(git rev-parse HEAD)"

usage() {
  cat <<'USAGE'
Usage: scripts/mmp-local-ci.sh <mode> [-- extra args]

Modes:
  quick       PR 전 기본 검증: diff, generated drift, Go focused checks, web lint/typecheck/test
  coverage    Go/Web coverage와 현재 CI coverage threshold 확인
  e2e         핵심 Playwright E2E 3종(chromium, real backend)
  docker      server Docker image build check
  full        quick + coverage + docker + e2e
  shell       local-ci 컨테이너 shell 진입
  config      docker compose config 검증
  clean       local-ci compose stack/volumes 정리
  help        도움말

Environment:
  MMP_LOCAL_CI_SKIP_INSTALL=1   pnpm install 단계를 건너뜀
  MMP_LOCAL_CI_PROJECT=name     compose project name override
USAGE
}

compose() {
  export MMP_LOCAL_CI_WORKDIR="$ROOT"
  export MMP_LOCAL_CI_GIT_COMMON="$GIT_COMMON_ABS"
  docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" "$@"
}

record_result() {
  local mode="$1"
  local status="$2"
  local started_at="$3"
  local finished_at
  finished_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  mkdir -p "$MARKER_DIR"
  cat > "$MARKER_FILE" <<EOF
{
  "mode": "$mode",
  "status": "$status",
  "head": "$HEAD_SHA",
  "started_at": "$started_at",
  "finished_at": "$finished_at",
  "compose_file": "$COMPOSE_FILE"
}
EOF
}

run_in_ci() {
  local mode="$1"
  local command="$2"
  local started_at
  started_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  set +e
  compose run --rm local-ci bash -lc "$command"
  local exit_code=$?
  set -e

  if [ "$exit_code" -eq 0 ]; then
    record_result "$mode" "success" "$started_at"
  else
    record_result "$mode" "failed" "$started_at"
  fi
  return "$exit_code"
}

bootstrap_cmd='
set -euo pipefail
if [ "${MMP_LOCAL_CI_SKIP_INSTALL:-}" != "1" ]; then
  pnpm install --frozen-lockfile
fi
'

quick_cmd="$bootstrap_cmd"'
git diff --check
cd apps/server
go generate ./...
git diff --exit-code
go run ./cmd/wsgen
git diff --exit-code ../../packages/shared/src/ws/types.generated.ts
cd ../..
bash scripts/check-playeraware-coverage.sh
cd apps/server
golangci-lint run ./...
DATABASE_URL="${DATABASE_URL}" REDIS_URL="${REDIS_URL}" go test -race ./...
go build ./cmd/server
cd ../..
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
pnpm turbo build
'

coverage_cmd="$bootstrap_cmd"'
cd apps/server
DATABASE_URL="${DATABASE_URL}" REDIS_URL="${REDIS_URL}" go test -race -coverprofile=coverage.out ./...
TOTAL=$(go tool cover -func=coverage.out | tail -1 | awk "{print \$3}" | tr -d "%")
THRESHOLD=41
if awk "BEGIN {exit !($TOTAL < $THRESHOLD)}"; then
  echo "Go coverage ${TOTAL}% is below threshold ${THRESHOLD}%"
  exit 1
fi
echo "Go coverage ${TOTAL}% >= ${THRESHOLD}%"
cd ../..
pnpm turbo build --filter=@mmp/web^...
pnpm --filter @mmp/web test:coverage
LINES=$(jq ".total.lines.pct" apps/web/coverage/coverage-summary.json)
BRANCHES=$(jq ".total.branches.pct" apps/web/coverage/coverage-summary.json)
FUNCTIONS=$(jq ".total.functions.pct" apps/web/coverage/coverage-summary.json)
FAIL=0
awk "BEGIN {exit !($LINES < 49)}" && { echo "FE lines coverage ${LINES}% < 49%"; FAIL=1; } || true
awk "BEGIN {exit !($BRANCHES < 77)}" && { echo "FE branches coverage ${BRANCHES}% < 77%"; FAIL=1; } || true
awk "BEGIN {exit !($FUNCTIONS < 53)}" && { echo "FE functions coverage ${FUNCTIONS}% < 53%"; FAIL=1; } || true
[ "$FAIL" = "0" ]
'

docker_cmd='
set -euo pipefail
docker build -f apps/server/Dockerfile -t mmp-server:local-ci apps/server
'

e2e_cmd="$bootstrap_cmd"'
cleanup() {
  [ -n "${SERVER_PID:-}" ] && kill "$SERVER_PID" 2>/dev/null || true
  [ -n "${WEB_PID:-}" ] && kill "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT
cd apps/server
go build -o /tmp/mmp-server ./cmd/server
E2E_DB_URL="${E2E_DATABASE_URL:-${DATABASE_URL}}"
goose -dir db/migrations postgres "${E2E_DB_URL}" up
DATABASE_URL="${E2E_DB_URL}" REDIS_URL="${REDIS_URL}" GAME_RUNTIME_V2=true /tmp/mmp-server > /tmp/mmp-server-local-ci.log 2>&1 &
SERVER_PID=$!
for i in $(seq 1 40); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    cat /tmp/mmp-server-local-ci.log
    exit 1
  fi
  curl -sf http://localhost:8080/health >/dev/null && break
  sleep 1
done
curl -sf http://localhost:8080/health >/dev/null
curl -s -o /tmp/seed-user.out -w "%{http_code}" \
  -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"e2e@test.com\",\"password\":\"e2etest1234\",\"nickname\":\"E2E Tester\"}" \
  | grep -Eq "^(201|409)$" || { cat /tmp/seed-user.out; exit 1; }
psql "${E2E_DB_URL}" -v ON_ERROR_STOP=1 < db/seed/e2e-themes.sql
cd ../..
pnpm --filter "@mmp/game-logic" --filter "@mmp/shared" --filter "@mmp/ws-client" build
cd apps/web
pnpm dev --host 0.0.0.0 > /tmp/mmp-web-local-ci.log 2>&1 &
WEB_PID=$!
for i in $(seq 1 40); do
  curl -sf http://localhost:3000 >/dev/null && break
  sleep 1
done
curl -sf http://localhost:3000 >/dev/null
pnpm exec playwright test \
  e2e/game-session.spec.ts \
  e2e/game-reconnect.spec.ts \
  e2e/game-redaction.spec.ts \
  --project=chromium \
  --retries=1
'

case "$MODE" in
  quick)
    run_in_ci quick "$quick_cmd"
    ;;
  coverage)
    run_in_ci coverage "$coverage_cmd"
    ;;
  e2e)
    run_in_ci e2e "$e2e_cmd"
    ;;
  docker)
    run_in_ci docker "$docker_cmd"
    ;;
  full)
    full_started_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    run_in_ci quick "$quick_cmd"
    run_in_ci coverage "$coverage_cmd"
    run_in_ci docker "$docker_cmd"
    run_in_ci e2e "$e2e_cmd"
    record_result full success "$full_started_at"
    ;;
  shell)
    compose run --rm local-ci bash "$@"
    ;;
  config)
    compose config
    ;;
  clean)
    compose down -v --remove-orphans
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
