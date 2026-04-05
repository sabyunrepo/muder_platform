# MMP v3 작업 체크리스트

> Phase별 진행. 완료 시 체크. 상세 설계는 `refs/` 참조.

## Phase 0: 분석 + 설계 ✅
- [x] 4개 에이전트 분석 + 기술 스택 결정 + 설계 문서 3종 + 모듈 29개 스펙

## Phase 1: 스캐폴딩 ✅
- [x] 새 Git 레포 + monorepo 루트 (Taskfile, turbo, pnpm-workspace)
- [x] Go 서버: cmd/server, internal/, config, middleware, apperror, health
- [x] React+Vite 웹: router, features/, shared/, services/
- [x] 패키지: shared, ws-client, game-logic, ui-tokens, eslint-config
- [x] Docker (scratch), docker-compose, CI (.github/workflows)
- [x] Go SEO: html/template (themes, privacy, terms)
- [x] CLAUDE.md

## Phase 2: 데이터 레이어 ✅
- [x] DB 스키마 (goose migration 6개, 8 테이블) + sqlc 설정 (33 쿼리) + Redis 레이어 (cache.Provider, lock.Locker)

## Phase 3: 게임 엔진 코어
- [ ] 모듈 시스템 (types, registry, eventbus, base)
- [ ] GameProgressionEngine (strategy, script/hybrid/event, action_dispatcher)
- [ ] PhaseEngine + modules↔phases 교차 검증

## Phase 4: WebSocket 인프라
- [ ] Hub, Client, Session, Router, Auth, 브로드캐스트, 재연결, Redis PubSub

## Phase 5: 게임 모듈 이식 (29개)
- [ ] Core 4개 → Progression 8개 → Communication 5개
- [ ] Decision 3개 → Exploration 4개 → Clue Distribution 5개

## Phase 6: REST API 도메인
- [ ] auth, room, theme, editor, coin/payment, profile, admin
- [ ] OpenAPI spec + TS 타입 생성

## Phase 7: 프론트엔드
- [ ] React Router + pages/ + features/ + 3레이어 상태
- [ ] WsClient (@mmp/ws-client) + 모듈별 동적 스토어
- [ ] 게임 UI (모듈별), 에디터, 로비, 결제, 프로필

## Phase 7.5: 소셜 (친구 + 채팅)
- [ ] DB + FriendService + ChatService + /ws/social + 읽음 확인 + 게임 연동

## Phase 7.6: 결제 + 수익/통계
- [ ] PaymentProvider + CoinService + EarningService + StatisticsService
- [ ] 제작자 대시보드 + Admin 정산

## Phase 7.7: 오디오/미디어
- [ ] theme_media DB + AudioManager + 미디어 라이브러리 탭
- [ ] ReadingModule + 리딩 UI + BGM 크로스페이드

## Phase 7.8: 에디터 확장
- [ ] 엔딩 분기 + 버전 관리 + 교차 검증 + 미리보기

## Phase 8: 통합 + QA
- [ ] E2E (Playwright) + 성능 테스트 + 보안 점검 + K8s 배포

## Phase 8.5: 보안/테스트/i18n
- [ ] JWT/OAuth/RBAC + Circuit Breaker + testutil + Vitest + i18n

## Phase 8.6: 데이터 이관 + 에셋 + Admin
- [ ] 이관 CLI + R2 에셋 + Admin 패널 (역할/감사로그)

## Phase 9: 모바일 (선택)
- [ ] Expo + @mmp/ws-client + 푸시 + 스토어 배포

---
**진행:** 2026-04-05 Phase 0~2 완료
