# 아키텍처 + WebSocket + 프론트엔드 + 데이터 + 인프라

## 전체 인프라
```
Client → Cloudflare CDN → Nginx Ingress
  /api/*     → mmp-server:8080 (REST)
  /ws        → mmp-server:8080 (WebSocket)
  /themes/*  → mmp-server:8080 (SEO HTML)
  /metrics   → mmp-server:9090 (Prometheus)
  /*         → CDN (React SPA)
```
Go 단일 바이너리 (Modular Monolith), K8s 1 Deployment + CDN.

## Go 서버 내부
```
cmd/server/main.go → DI 조립
  Middleware: OTel → JWT → RateLimit → CORS → Logger
  HTTP Router (Chi) + WebSocket Hub (gorilla)
  Session goroutine: FSM + PhaseEngine + Modules + EventBus
  Infrastructure: sqlc/pgx + go-redis + asynq
```

## WebSocket Hub (Socket.IO 대체)
| Socket.IO | Go Hub |
|-----------|--------|
| io.to(room).emit() | hub.BroadcastToSession() |
| socket.emit() | hub.SendToPlayer() |
| 귓속말 | hub.Whisper() |
| Namespace | 메시지 type prefix (game:, chat:) |
| Redis Adapter | Redis PubSub (cross-node) |
| connectionStateRecovery | 60초 이벤트 버퍼 + Redis 스냅샷 |

메시지: JSON → `{ type, payload, ts, seq }`
WS 분리: `/ws/game` (게임) vs `/ws/social` (소셜 채팅)

## 프론트엔드 (React 19 + Vite SPA)
```
src/
  pages/       라우트 (React Router, lazy loading)
  features/    도메인 모듈 (auth, lobby, room, game, editor, payment, admin, voice, social, creator)
  shared/      공통 컴포넌트
  services/    API client + WS client
```
SEO: Go html/template (themes/:slug, privacy, terms만)
배포: Cloudflare Pages (CDN 정적)

## 상태 관리 3레이어
```
Layer 3: UI (컴포넌트 로컬)
Layer 2: Domain (Zustand stores per feature)
Layer 1: Connection (WsClient)
```

## 데이터
- PostgreSQL (진실의 원천) + Redis (캐시/pub-sub) + In-Process (세션 goroutine)
- sqlc Thin Repository → 도메인 인터페이스
- 5초 디바운스 Redis 스냅샷 → 서버 재시작 복구

## Monorepo
```
apps/server (Go), apps/web (React+Vite), apps/mobile (Expo)
packages/shared, game-logic, ws-client, ui-tokens, eslint-config
tooling/typescript, tailwind
Taskfile.yml + turbo.json
```

## Go ↔ TS 타입 공유
- REST: Go → OpenAPI spec → openapi-typescript
- WebSocket: packages/shared/ws/ (source of truth) → Go struct 수동 동기화 + CI 검증
- configJson: Zod(TS) + JSON Schema → Go struct
