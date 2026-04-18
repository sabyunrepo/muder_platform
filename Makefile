.PHONY: up down build build-no-cache logs ps lint lint-go lint-web test migrate seed ci-local graphify-setup graphify-watch graphify-update

# ---------------------------------------------------------------------------
# Core commands
# ---------------------------------------------------------------------------

## up dev  — DB/Redis/Server + Vite dev server
## up prod — Full stack via Nginx (single port 80)
up:
ifeq ($(filter prod,$(MAKECMDGOALS)),prod)
	docker compose up -d --build
else
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
	@if lsof -iTCP:3000 -sTCP:LISTEN -t >/dev/null 2>&1; then \
		echo "✓ Vite dev server already running on :3000"; \
	else \
		echo "→ Starting Vite dev server..."; \
		cd apps/web && pnpm dev & \
		sleep 2; \
		echo "✓ Vite dev server started on :3000"; \
	fi
endif

## down — Stop all services
down:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down 2>/dev/null; \
	docker compose down 2>/dev/null; true

## build — Build all Docker images
build:
	docker compose build

## build-no-cache — Build all Docker images without cache
build-no-cache:
	docker compose build --no-cache

## logs [service] — Tail logs (e.g. make logs s=server)
logs:
	docker compose logs -f $(s)

## ps — Show running services
ps:
	docker compose ps

# ---------------------------------------------------------------------------
# Lint
# ---------------------------------------------------------------------------

## lint — Run all linters (Go + Web)
lint: lint-go lint-web

## lint-go — Run golangci-lint v2 on apps/server (requires golangci-lint v2.11.4+)
lint-go:
	cd apps/server && golangci-lint run ./...

## lint-web — Run ESLint on apps/web
lint-web:
	cd apps/web && pnpm lint

# ---------------------------------------------------------------------------
# Test / DB / Local CI parity
# ---------------------------------------------------------------------------

## test — Run Go + Web unit tests (local CI parity)
test:
	cd apps/server && go test -race ./...
	cd apps/web && pnpm test

## typecheck — TypeScript typecheck only
typecheck:
	cd apps/web && pnpm tsc --noEmit

## build-web — Frontend build (turbo build)
build-web:
	cd apps/web && pnpm turbo build

## build-server — Go server build
build-server:
	cd apps/server && go build ./cmd/server

## migrate — Apply goose migrations (requires DATABASE_URL)
migrate:
	cd apps/server && goose -dir db/migrations postgres "$(DATABASE_URL)" up

## seed — Seed E2E fixtures (requires DATABASE_URL)
seed:
	psql "$(DATABASE_URL)" -v ON_ERROR_STOP=1 -f apps/server/db/seed/e2e-themes.sql

## ci-local — Reproduce GitHub Actions CI gate locally (lint + typecheck + test + build)
##            Phase 20 기간: GitHub Actions 계정 비활성 상태이므로
##            admin bypass merge 전에 반드시 이 체크 통과 후 진행할 것.
ci-local: lint-go lint-web typecheck test build-server build-web
	@echo "✓ Local CI parity check passed (lint + typecheck + test + build)"

# Prevent make from treating 'dev'/'prod' as file targets
dev prod:
	@true

# ---------------------------------------------------------------------------
# Graphify (knowledge graph tooling)
# ---------------------------------------------------------------------------

## graphify-setup — graphify CLI + git hooks 설치 (clone 직후 1회)
##                  pipx install graphifyy → graphify hook install
##                  post-commit / post-checkout hook으로 `graphify update` 자동 실행
graphify-setup:
	@command -v graphify >/dev/null 2>&1 || { \
		command -v pipx >/dev/null 2>&1 || { echo "pipx 필요: brew install pipx" >&2; exit 1; }; \
		pipx install graphifyy; \
	}
	graphify hook install
	@echo "✓ graphify CLI + git hooks 설치 완료"

## graphify-watch — 코드 변경 감지 + AST 자동 재빌드 (LLM 토큰 0)
##                  tmux/screen 안에서 백그라운드 실행 권장
##                  MD/PDF 변경은 알림만 — 문서 대량 변경 시 `/graphify . --update` 권장
graphify-watch:
	graphify watch .

## graphify-update — 마지막 커밋 이후 변경된 코드만 증분 재추출 (AST, 토큰 0)
##                   post-commit hook 미설치 환경에서 수동 동기화용
graphify-update:
	graphify update .
