.PHONY: up down build build-no-cache logs ps lint lint-go lint-web

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

# Prevent make from treating 'dev'/'prod' as file targets
dev prod:
	@true
