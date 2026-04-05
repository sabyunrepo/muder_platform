# 기술 스택 상세

| 계층 | v2 | v3 | 변경 이유 |
|------|-----|-----|----------|
| 백엔드 | TypeScript (Node.js) | **Go 1.25** | goroutine 동시성, 10x WS, 단일 바이너리 |
| HTTP | Express 5 | **Chi** | 경량, Go 관용적 |
| 실시간 | Socket.IO 4 | **네이티브 WebSocket** (gorilla) | 프로토콜 오버헤드 제거 |
| ORM | Prisma | **sqlc + pgx/v5** | SQL→타입 생성, 제로 오버헤드 |
| 마이그레이션 | Prisma Migrate | **goose** | SQL 파일 기반 |
| 큐 | BullMQ | **asynq** | Redis 재사용, 동일 패러다임 |
| Redis | ioredis + node-redis | **go-redis v9** (단일) | 클라이언트 통합 |
| 분산 락 | Lua 스크립트 | **redsync** + goroutine 직렬화 | 단일 인스턴스 락 불필요 |
| 로깅 | Pino | **zerolog** | Gateway에서 사용 중, 제로 할당 |
| 메트릭 | prom-client | **prometheus/client_golang** | Gateway에서 사용 중 |
| 트레이싱 | 없음 | **OpenTelemetry Go SDK** | 신규 |
| 에러 | Sentry (Node) | **sentry-go** | 유지 |
| 프론트 | Next.js 16 | **React 19 + Vite** (SPA) | SSR 불필요, CDN 배포 |
| SEO | Next.js SSR | **Go html/template** (3-4페이지) | 서버 렌더링 |
| 상태 | Zustand | **Zustand** (유지) | 3레이어 분리 |
| 스타일 | Tailwind 4 | **Tailwind 4** (유지) | |
| 모바일 | Expo | **Expo** (유지) | 패키지 공유 강화 |
| 빌드 | Turborepo | **Taskfile + Turborepo** | Go+TS 하이브리드 |
| 컨테이너 | Node Alpine ~300MB | **scratch ~15MB** | 20x 축소 |
| K8s | 4 Deployment | **1 Deployment + CDN** | Node.js 제거 |
| 프론트 배포 | K8s pods | **Cloudflare Pages** | 정적 CDN |
