---
name: MMP v3 Docker/Nginx 인프라 구조
description: Docker Compose + Nginx 리버스 프록시 구조, dev/prod 모드 분리, Makefile 사용법
type: project
---

Docker Compose로 전체 스택 관리. Nginx가 단일 외부 진입점.

**Why:** 나중에 Cloudflare Tunnel로 외부 연결 예정. Nginx:80만 노출하고 나머지는 internal network.

**How to apply:**
- **Prod**: `make up prod` → Nginx:80 (SPA + `/api/*`, `/ws/*` 리버스 프록시)
- **Dev**: `make up dev` → DB/Redis/Server docker + Vite dev server (port 3000, 자동 감지)
- `make down`, `make build`, `make build-no-cache`, `make logs s=server`, `make ps`

**서비스 구성:**
| 서비스 | 이미지 | Prod 포트 | Dev 포트 |
|--------|--------|-----------|----------|
| web | nginx + SPA build | 80 (외부) | 비활성 (Vite 사용) |
| server | Go binary (distroless) | internal | 8080, 9090 |
| postgres | postgres:17-alpine | internal | 5432 |
| redis | redis:7-alpine | internal | 6379 |

**주요 파일:**
- `docker-compose.yml` — prod 기본 구성
- `docker-compose.dev.yml` — dev override (포트 노출, web 비활성)
- `apps/web/nginx.conf` — SPA 서빙 + API/WS 리버스 프록시
- `apps/web/Dockerfile` — pnpm workspace 빌드 → nginx 서빙
- `apps/server/Dockerfile` — Go 1.25 multi-stage (distroless)
- `Makefile` — dev/prod 명령어 통합
