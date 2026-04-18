---
name: MMP v3 프로젝트 개요
description: 머더미스터리 게임 플랫폼 v3 클린 리빌드 - 기술 스택, 아키텍처, 핵심 설계 결정
type: project
---

다중 테마 실시간 멀티플레이어 머더미스터리 게임 플랫폼 v3. 새 레포에서 처음부터 작성.

**기술 스택:**
- Backend: Go 1.25 + Chi + gorilla/websocket + sqlc + pgx + asynq + go-redis + zerolog
- Frontend: React 19 + Vite (SPA) + Zustand + Tailwind CSS 4 + React Router
- Mobile: Expo (React Native)
- DB: PostgreSQL + Redis
- Voice: LiveKit
- Infra: Docker (scratch ~15MB) + K8s 1 Deployment + Cloudflare Pages + GitHub Actions

**아키텍처:** Modular Monolith, 단일 Go 바이너리
- Client → Cloudflare CDN → Nginx Ingress → mmp-server:8080
- WS 분리: /ws/game (게임) vs /ws/social (소셜)
- Monorepo: apps/server, apps/web, apps/mobile + packages/shared,ws-client,game-logic,ui-tokens,eslint-config

**핵심 설계 결정:**
1. Go 선택 (goroutine 동시성, 10x WS, 15MB 바이너리)
2. Next.js 제거 → React+Vite SPA (SSR 0개, CDN 정적 배포)
3. 동적 페이즈 스크립트 러너 (고정 FSM 아님), 3가지 Strategy
4. 29개 모듈 시스템: BaseModule + ConfigSchema + PhaseReactor + AutoContent
5. Factory 패턴 (세션별 모듈 인스턴스, 싱글턴 금지)
6. sqlc + pgx (SQL→타입 생성, 제로 오버헤드)
7. 상태 3레이어: Connection(WsClient) / Domain(Zustand) / UI(로컬)

**Why:** 기존 v2의 Node.js/Socket.IO/Prisma/Next.js 스택에서 성능·단순성·배포 효율을 위해 전면 리빌드
**How to apply:** 모든 구현은 이 스택과 패턴을 따라야 함. 설계 문서는 docs/plans/2026-04-05-rebuild/ 참조
