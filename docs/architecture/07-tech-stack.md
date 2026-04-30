---
file: 07-tech-stack.md
purpose: 기술 스택 버전 + 최소 실행 환경 + 첫 실행 절차
audience: design-AI
last_verified: 2026-04-30
sources_of_truth:
  - apps/server/go.mod
  - apps/web/package.json
  - apps/server/CLAUDE.md
  - apps/web/CLAUDE.md
  - memory/project_infra_docker.md
related: [02-backend.md, 03-frontend.md, 06-infra-cicd.md]
---

# 07. Tech Stack & Minimum Spec

## 백엔드 (Go) {#backend}

| 영역 | 기술 | 버전 | 출처 |
|---|---|---|---|
| 언어 | Go | 1.25.0 | apps/server/go.mod:3 |
| HTTP 라우터 | go-chi/chi | v5.2.1 | go.mod:11 |
| WebSocket | gorilla/websocket | v1.5.4 (pre-release) | go.mod:17 |
| DB 드라이버 | jackc/pgx | v5.9.1 | go.mod:18 |
| DB 코드생성 | sqlc | (toolchain, repo CI) | apps/server/internal/db/*.sql.go |
| Migration | pressly/goose | v3.27.0 | go.mod:21 |
| Redis 클라이언트 | redis/go-redis | v9.18.0 | go.mod:22 |
| 로거 | rs/zerolog | v1.34.0 | go.mod:23 |
| 검증 | go-playground/validator | v10.30.2 | go.mod:14 |
| JWT | golang-jwt/jwt | v5.3.1 | go.mod:15 |
| Voice SDK | livekit-server-sdk-go | v2.16.1 | go.mod:20 |
| Sentry | getsentry/sentry-go | v0.44.1 | go.mod:10 |
| OTel | go.opentelemetry.io/otel | v1.43.0 | go.mod:26 |
| Mock | go.uber.org/mock (mockgen) | v0.6.0 | go.mod:31 |
| 통합 테스트 | testcontainers-go | v0.42.0 | go.mod:24 |
| S3 SDK | aws-sdk-go-v2/service/s3 | v1.98.0 | go.mod:9 |
| JSON Logic (조건빌더) | diegoholiveira/jsonlogic | v3.9.0 | go.mod:8 |

## 프론트엔드 (React) {#frontend}

| 영역 | 기술 | 버전 | 출처 |
|---|---|---|---|
| UI 라이브러리 | react / react-dom | ^19.0.0 | apps/web/package.json:35-36 |
| 빌드 | vite | ^6.0.0 | package.json:65 |
| 타입스크립트 | typescript | ^5.7.3 | package.json:63 |
| 라우터 | react-router | ^7.1.0 | package.json:40 |
| 상태 | zustand | ^5.0.0 | package.json:42 |
| 스타일 | tailwindcss / @tailwindcss/vite | ^4.0.0 | package.json:48,62 |
| 아이콘 | lucide-react | ^0.468.0 | package.json:33 |
| 데이터 패칭 | @tanstack/react-query | ^5.96.2 | package.json:29 |
| 캔버스(에디터) | @xyflow/react | ^12.10.2 | package.json:30 |
| Voice 클라 | livekit-client | ^2.18.1 | package.json:32 |
| 토스트 | sonner | ^2.0.7 | package.json:41 |
| 마크다운 | marked | ^17.0.6 | package.json:34 |
| 이미지 크롭 | react-easy-crop / react-image-crop | ^5.5.7 / ^11.0.10 | package.json:37-38 |
| HTML 살균 | dompurify | ^3.3.3 | package.json:31 |
| 에러 경계 | react-error-boundary | ^6.1.1 | package.json:39 |
| Sentry | @sentry/react | ^10.47.0 | package.json:28 |
| 테스트 러너 | vitest | ^2.1.0 | package.json:67 |
| RTL | @testing-library/react | ^16.3.2 | package.json:50 |
| API 목 | msw | ^2 | package.json:60 |
| E2E | @playwright/test | ^1.59.1 | package.json:46 |
| 접근성 | @axe-core/playwright | ^4.11.2 | package.json:44 |
| PWA | vite-plugin-pwa | ^1.2.0 | package.json:66 |

## 워크스페이스 (pnpm monorepo) {#workspace}

| 패키지 | 역할 |
|---|---|
| `apps/server` | Go 백엔드 (단일 바이너리 모놀리스) |
| `apps/web` | React SPA |
| `apps/mobile` | Expo (React Native) — UNVERIFIED 활성도 |
| `packages/shared` | Go ↔ TS 공유 타입 (REST는 OpenAPI, WS는 수동 동기화) |
| `packages/ws-client` | WebSocket 클라이언트 (재접속 + auth.resume) |
| `packages/game-logic` | 클라이언트 측 게임 로직 |
| `packages/ui-tokens` | 디자인 토큰 (Tailwind 4 직접 사용) |
| `packages/eslint-config` | 공유 ESLint config |

## 데이터 스토어 {#stores}

| 스토어 | 버전 | Dev 호스트 포트 | 비고 |
|---|---|---|---|
| PostgreSQL | 17-alpine | localhost:**25432** | Default 5432 충돌 회피 |
| Redis | 7-alpine | localhost:**26379** | Default 6379 충돌 회피 |

## 인프라 {#infra}

| 영역 | 기술 | 출처 |
|---|---|---|
| 컨테이너 | Docker (multi-stage, distroless server, scratch ~15MB target) | apps/server/Dockerfile |
| 오케스트레이션 | docker-compose (dev/prod 분리) | docker-compose.yml + .dev.yml |
| 리버스 프록시 | Nginx | apps/web/nginx.conf |
| CI | GitHub Actions + ARC self-hosted runners | .github/workflows/, Phase 22~23 |
| Runner registry | GHCR (ghcr.io) — Phase 23 이전 (KT registry → ghcr) | commit 035f004 |
| 배포 (계획) | Cloudflare Pages (web) + K8s 1 Deployment (server) | memory/project_overview.md |

## 최소 실행 환경 {#minimum-env}

- **Host OS**: macOS 12+ / Linux x86_64 (Apple Silicon 동작 확인됨)
- **Docker Desktop / Engine**: 24+ (Compose v2)
- **Node.js**: 20+ (workspace bootstrap 시 필요)
- **pnpm**: 9+ (corepack 권장)
- **Go**: 1.25+ (server 직접 빌드 시. 컨테이너 빌드면 불필요)
- **direnv** (선택): `HOST_UID/HOST_GID` 자동 export 용

## 필수 환경 변수 (서버) {#env}

> 출처: `apps/server/internal/config/`. 정확한 필드명·기본값은 `internal/config/config.go` 참조.

- `DATABASE_URL` (postgres connection)
- `REDIS_URL`
- `JWT_SECRET`
- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` / `LIVEKIT_URL` (음성 사용 시)
- `S3_BUCKET` / `S3_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (이미지 업로드)
- `SENTRY_DSN` (옵션, 미설정 시 no-op)
- `OTEL_EXPORTER_OTLP_ENDPOINT` (옵션, 미설정 시 no-op)
- `HOST_UID` / `HOST_GID` (dev compose 한정 — UID 매칭용)

## 첫 실행 절차 (Dev) {#first-run}

```bash
# 1) workspace bootstrap
pnpm install

# 2) ws-client 빌드 (apps/web pretest 자동 호출도 가능)
pnpm --filter @mmp/shared build
pnpm --filter @mmp/game-logic build
pnpm --filter @mmp/ws-client build

# 3) dev 스택 기동 (postgres:25432, redis:26379, server:8080)
HOST_UID=$(id -u) HOST_GID=$(id -g) make up dev
# 또는
HOST_UID=$(id -u) HOST_GID=$(id -g) docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# 4) 프론트 dev server (Vite)
pnpm --filter @mmp/web dev   # http://localhost:3000

# 5) DB migration (자동 — server 시작 시 goose Up 실행)
#    수동: cd apps/server && goose -dir db/migrations postgres "$DATABASE_URL" up
```

## Migration 시퀀스 {#migrations}

> 출처: `apps/server/db/migrations/` 디렉토리.

```
00001~00006   초기 스키마 (users, themes, sessions, rooms ...)
00007         social (친구·DM)
00008~00013   에디터, 결제, 알림 (코인/notification_preferences)
00014         social_enhancements (role/metadata/deleted_at/IMAGE)
00015         theme_media
00017         media_type_video
00020~00025   Phase 20 — clue 통합 + 라운드 필터 + 통합 clue_edge_groups (00024)
```

> AI 주의: 새 migration은 시퀀스 번호 + `goose -- +goose Up/Down` 헤더 필수. 외래키 변경은 `memory/feedback_migration_workflow.md` 6전문가 토론 절차 따름.

## 테스트 커버리지 게이트 {#coverage}

| 영역 | Lines | Branches | Functions | 목표 |
|---|---|---|---|---|
| Go (server) | 41% (현재 enforcement) | — | — | 75%+ |
| Web (React) | 49% | 77% | 53% | 75%+ (Phase 21) |

## 파일 크기 한도 {#file-size-tier}

| 종류 | Hard limit | 함수/컴포넌트 |
|---|---|---|
| `.go` | 500줄 | 함수 80줄 (table-driven 데이터 제외) |
| `.ts` / `.tsx` | 400줄 | 함수 60줄 / JSX 컴포넌트 150줄 |
| `.md` | 500줄 | (CLAUDE.md만 200줄) |

> 강제: `memory/feedback_file_size_limit.md`. 자동생성(sqlc/gen) 예외.
