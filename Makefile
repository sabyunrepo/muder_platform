.PHONY: up down build build-no-cache logs ps lint lint-go lint-web test migrate seed ci-local \
        graphify-setup graphify-install-hooks graphify-uninstall-hooks \
        graphify-watch graphify-update graphify-refresh

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
# Graphify (knowledge graph tooling) — D 정책 (2026-04-18~)
#   repo graphify-out/graph.json 은 Phase 종료 시점에만 수동 fresh rebuild + PR.
#   일상 post-commit / watch / update 는 "개인 로컬 전용" — 결과물 커밋 금지.
#   이유: AST-only 재빌드가 semantic 개념 노드 ~6% 영구 손실 (upstream 버그).
# ---------------------------------------------------------------------------

## graphify-setup — graphify CLI 설치 (clone 직후 1회, hook 자동 설치 아님)
##                  개인용 자동 동기화 원하면 make graphify-install-hooks 별도 실행
graphify-setup:
	@command -v graphify >/dev/null 2>&1 || { \
		command -v pipx >/dev/null 2>&1 || { echo "pipx 필요: brew install pipx" >&2; exit 1; }; \
		pipx install graphifyy; \
	}
	@echo "✓ graphify CLI 설치 완료"
	@echo "ℹ  post-commit hook은 기본 설치 안 함 (개인 선택: make graphify-install-hooks)"
	@echo "ℹ  repo graph.json은 Phase 종료 시에만 fresh rebuild — make graphify-refresh"

## graphify-install-hooks — (선택) post-commit/post-checkout hook 설치 — 개인 로컬 전용
##                          ⚠ AST 증분이 semantic 개념 노드 덮어쓰므로 결과 repo 커밋 금지
graphify-install-hooks:
	graphify hook install
	@echo "⚠  hook 설치됨 (개인 로컬용). graph.json/REPORT를 repo에 커밋하지 말 것."

## graphify-uninstall-hooks — post-commit/post-checkout hook 제거
graphify-uninstall-hooks:
	graphify hook uninstall

## graphify-watch — 코드 변경 감지 + AST 재빌드 (LLM 토큰 0, 로컬 전용)
##                  tmux/screen 권장. ⚠ 결과물 repo 커밋 금지
graphify-watch:
	graphify watch .

## graphify-update — 변경 코드만 증분 재추출 (AST, 토큰 0, 로컬 전용)
##                   ⚠ 결과물 repo 커밋 금지
graphify-update:
	graphify update .

## graphify-refresh — Phase 종료 시점 fresh rebuild 안내 (실제 실행은 Claude Code에서)
graphify-refresh:
	@echo "========================================================================"
	@echo " Phase 종료 시점 fresh rebuild 워크플로우"
	@echo "========================================================================"
	@echo ""
	@echo "1. Claude Code 세션을 새로 열고 다음을 입력:"
	@echo "     /graphify ."
	@echo ""
	@echo "2. detect 경고가 뜨면 '전체 진행'으로 응답"
	@echo "3. 결과를 PR로 커밋:"
	@echo "     graphify-out/graph.json"
	@echo "     graphify-out/GRAPH_REPORT.md"
	@echo "     graphify-out/manifest.json"
	@echo "   (cache/는 gitignore로 커밋 제외됨)"
	@echo ""
	@echo "캐시 적중으로 변경된 MD만 재추출됩니다 (Phase당 ~\$$0.15–2)."
