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

## Phase 3: 게임 엔진 코어 ✅
- [x] 모듈 시스템 (types, registry, eventbus, base)
- [x] GameProgressionEngine (strategy, script/hybrid/event, action_dispatcher)
- [x] PhaseEngine + modules↔phases 교차 검증

## Phase 4: WebSocket 인프라 ✅
- [x] Hub, Client, Session, Router, Auth, 브로드캐스트, 재연결, Redis PubSub

## Phase 5: 게임 모듈 이식 (29개) ✅
- [x] Core 4개 (connection, room, ready, clue_interaction) — 39 테스트
- [x] Progression 8개 (script/hybrid/event, skip_consensus, gm/consensus_control, reading, ending) — 38 테스트
- [x] Communication 5개 (text_chat, whisper, group_chat, voice_chat, spatial_voice) — 62 테스트
- [x] Decision 3개 (voting, accusation, hidden_mission) — 43 테스트
- [x] Exploration 4개 (floor/room/timed_exploration, location_clue) — 44 테스트
- [x] Clue Distribution 5개 (conditional/starting/round/timed_clue, trade_clue) — 60 테스트

## Phase 6: REST API 도메인 ✅
- [x] auth (OAuth callback, JWT, refresh rotation, logout, me) — 7 테스트
- [x] profile (get, update, public view) — 6 테스트
- [x] room (create, join, leave, list, code lookup) — 8 테스트
- [x] theme (list published, get by ID/slug, characters) — 6 테스트
- [x] editor (theme/character CRUD, publish/unpublish, configJson) — 12 테스트
- [x] admin (user/theme/room management, role change) — 9 테스트
- [x] 공유 인프라: httputil (JSON/pagination), JWT middleware, RequireRole — 8 테스트
- [x] main.go DI 조립 + /api/v1/ 라우트 등록
- [x] OpenAPI 3.1 spec (29 endpoints, 27 schemas) + Taskfile api:types 태스크

## Phase 7: 프론트엔드
- [ ] React Router + pages/ + features/ + 3레이어 상태
- [ ] WsClient (@mmp/ws-client) + 모듈별 동적 스토어
- [ ] 게임 UI (모듈별), 에디터, 로비, 결제, 프로필

## Phase 7.5: 소셜 (친구 + 채팅)
- [ ] DB + FriendService + ChatService + /ws/social + 읽음 확인 + 게임 연동

## Phase 7.6: 결제 + 수익/통계 ✅
- [x] PaymentProvider(Strategy+Mock) + CoinService + CreatorService + SettlementPipeline
- [x] EventBus 이벤트 기반 도메인 연결 (PaymentConfirmed, ThemePurchased, ThemeRefunded, GameStarted)
- [x] DB: 6 테이블 + users/themes 확장, 41 sqlc 쿼리
- [x] REST API: 22 endpoints (payment 5 + coin 5 + creator 4 + admin 8)
- [x] 보안: S1~S10 준수 (서버사이드 가격, 웹훅 서명, 자전거래 방지, 환불 3중검증, DB CHECK)
- [x] 프론트엔드: 22 React Query hooks, 15+ 컴포넌트, 13 라우트
- [x] 제작자 대시보드 (통계 차트, 수익, 정산) + Admin 정산 관리
- [x] Go 39 테스트 PASS + FE ~23 테스트 + TypeScript 0 errors

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
**진행:** 2026-04-05 Phase 0~6 완료, 2026-04-06 Phase 7-C~7.5+7.6 완료
