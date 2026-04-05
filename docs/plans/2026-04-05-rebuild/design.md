# MMP v3 클린 리빌드 — 설계 인덱스

> 새 Git 레포에서 처음부터 작성. 상세는 `refs/` 참조.

## 프로젝트 요약
- **백엔드**: Go 1.25 (goroutine, 네이티브 WebSocket, 단일 바이너리 15MB)
- **프론트**: React 19 + Vite (SPA, CDN 배포, Node.js 완전 제거)
- **DB**: sqlc + pgx + goose (PostgreSQL) + go-redis (Redis)
- **아키텍처**: Modular Monolith, K8s 1 Deployment + Cloudflare Pages
- **게임 엔진**: configJson.phases 동적 스크립트 러너 (고정 FSM 아님)
- **모듈**: 29개 (BaseModule + ConfigSchema + PhaseReactor + AutoContent)
- **에디터**: 고정 7탭 + 동적 4탭, ConfigSchema 자동 UI, 미디어 라이브러리

## 상세 레퍼런스

| 파일 | 내용 |
|------|------|
| [refs/tech-stack.md](refs/tech-stack.md) | 기술 스택 비교표 (v2 → v3) |
| [refs/architecture.md](refs/architecture.md) | 아키텍처, WebSocket Hub, 프론트, 데이터, 인프라, monorepo |
| [refs/game-engine.md](refs/game-engine.md) | 동적 페이즈, Strategy 패턴, ActionDispatcher, 세션 goroutine |
| [refs/patterns-social-payment.md](refs/patterns-social-payment.md) | Provider/Repository/Event-Driven, 소셜(친구/채팅), 결제/수익 |
| [refs/security-testing-i18n.md](refs/security-testing-i18n.md) | 보안, 성능 SLA, 테스트, i18n, 데이터이관, Admin, 모바일 |
| [refs/audio-editor.md](refs/audio-editor.md) | 미디어 라이브러리, 리딩 섹션, BGM, 에디터 탭 구조 |
| [module-spec.md](module-spec.md) | 29개 모듈 인덱스 + PhaseAction 12종 |
| [refs/modules/core.md](refs/modules/core.md) | Core 모듈 4개 상세 |
| [refs/modules/progression.md](refs/modules/progression.md) | Progression 모듈 8개 상세 |
| [refs/modules/communication.md](refs/modules/communication.md) | Communication 모듈 5개 상세 |
| [refs/modules/decision.md](refs/modules/decision.md) | Decision 모듈 3개 상세 |
| [refs/modules/exploration.md](refs/modules/exploration.md) | Exploration 모듈 4개 상세 |
| [refs/modules/clue-distribution.md](refs/modules/clue-distribution.md) | Clue Distribution 모듈 5개 상세 |

## 핵심 설계 결정

1. **Go 선택** — goroutine 동시성, 10x WS, 단일 바이너리 (Rust 대비 개발 속도)
2. **Next.js 제거** — SSR 0개 사용, CDN 정적 배포, Node.js 완전 제거
3. **동적 페이즈** — configJson.phases 스크립트 러너, 3가지 Strategy
4. **모듈 = 설정 단일 소스** — initialSettings 제거, ConfigSchema 자동 UI
5. **Factory 패턴** — 세션별 모듈 인스턴스 (싱글턴 버그 해결)
6. **PhaseReactor** — 모듈이 선언적으로 PhaseAction에 반응 (OCP)
7. **콘텐츠 = 고정형 + 자율형** — 모듈 연동 자동 생성 + 제작자 임의 생성
8. **Voting 통합** — 공개+비밀 mode 설정으로 단일 모듈
9. **밀담 = 사전 생성 방** — PhaseAction으로 개폐, 음성 채널 자동 이동
10. **히든 미션 점수제** — auto/self_report/gm_verify + 점수 합산 MVP

## 유지하는 것
- 모듈 시스템 패턴 (BaseModule + Registry + configJson)
- 15개 도메인 구조, Redis 캐싱/락/pub-sub
- Zustand + Tailwind 다크 모드 + LiveKit + GSAP + Howler

## 변경하는 것
- Express+Socket.IO → Go+네이티브 WS
- Prisma → sqlc, BullMQ → asynq
- Next.js → React+Vite SPA, 4 K8s → 1 + CDN
- 싱글턴 → Factory, 전역 EventBus → 세션 스코프
- 고정 FSM → 동적 스크립트 러너
