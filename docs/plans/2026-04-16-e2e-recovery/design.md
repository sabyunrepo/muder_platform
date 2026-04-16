# Phase 18.6 — E2E Recovery 설계 (index)

> **상태**: 초안
> **시작**: 2026-04-16
> **선행**: Phase 18.4 (완료), PR #48 (CI seed/migrate/build 복구 머지됨)
> **목표**: `e2e-stubbed` job의 남은 E2E 실패 해소 — login timeout + theme seed.

---

## 배경

PR #48로 CI의 치명적 infra 3건 복구:
- `e2e@test.com` user seed
- goose migrations 실행
- `@mmp/game-logic` workspace build

이제 실제 테스트 실행까지 진입하지만 **game-session.spec.ts 6 tests 모두 beforeEach login 30s 타임아웃**으로 fail.

## 남은 실패 매트릭스

| # | 증상 | 추정 원인 | Severity |
|---|------|-----------|----------|
| 1 | `locator.fill("이메일")` 30s 타임아웃 | SPA /login 렌더 이슈 (placeholder 변경, 리다이렉트, or hydration 지연) | High |
| 2 | createRoom 시나리오 테마 미존재 | theme seed 누락 (`test.skip(roomId === "NO_THEMES")` 방어만) | Medium |
| 3 | game-reconnect/game-redaction 연쇄 실패 | #1 동일 로그인 헬퍼 공유 | High |

상세: [refs/findings.md](refs/findings.md)

## 5대 결정

| # | 결정 | 선택 | 근거 |
|---|------|------|------|
| 1 | login 헬퍼 방식 | localStorage 주입 대신 **실제 폼 통과** | 실제 backend 모드 유지 시 token 정합성 — 직접 주입은 API 호출 시 401 |
| 2 | 타임아웃 원인 파악 | Playwright trace + console log | 로컬 재현 어려움 → artifact 기반 분석 |
| 3 | theme seed 방법 | E2E seed 전용 SQL 파일 + psql 실행 | register API 없음, SQL INSERT가 최단 |
| 4 | login helper 공용화 | `apps/web/e2e/helpers/auth.ts`에 단일 헬퍼 추출 | game-session/reconnect/redaction 3곳에 동일 로직 |
| 5 | Feature flag 게이트 | 해당 없음 — 테스트 인프라만 수정 | - |

---

## Out of scope
- Playwright config 개편 (project별 분리)
- 새 E2E 시나리오 추가
- 프로덕션 auth flow 변경
