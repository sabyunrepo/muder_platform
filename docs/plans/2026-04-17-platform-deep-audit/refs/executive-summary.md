# Executive Summary — Phase 19 Platform Deep Audit

> **Audit 기간**: 2026-04-17
> **Scope**: 9 영역(go-backend · react-frontend · module · test · security · perf · a11y · docs · ws-contract)
> **방식**: W1 Foundation(baseline + severity + inventory + test-baseline) → W2 Specialists 9 병렬 drafts → W3a Advisor intake → W3c Synthesis
> **호출 예산**: 11 중 2 사용

## 총계
- 총 Finding **89건** (P0: 9 / P1: 52 / P2: 28) — F-a11y-1 @jittda/ui finding 제거(감사 전제 오류, 사용자 확정)
- Cross-cutting issue **8건** (W3a advisor intake 식별)
- Synthesis PR 후보 **9건** (PR-0 MEMORY migration 선행 추가)

## ✅ Resolved Decisions (사용자 확정 2026-04-17)
1. **WS naming SSOT = 서버 기준** (envelope_catalog.go). 프론트 enum·MSW 전부 서버 맞춤 + codegen
2. **@jittda/ui 감사 제외** — 이 프로젝트 의존성 아님. 실제 스택 = Tailwind 4 직접 사용
3. **mockgen 규약 유지 (재도입)** — PR-5 Coverage Gate에 `go:generate mockgen` 전면 도입 서브태스크
4. **MEMORY canonical = Repo** (`memory/`). user home 34 파일 중 누락분 복원 → PR-0 선행

## P0 (10건, 다음 릴리스 전 필수)

### 보안 P0 (4건)
1. **F-sec-1 / F-go-1**: RFC 9457 우회 `http.Error` 12곳(seo·storage·ws/upgrade) → apperror 전환 → **PR-3**
2. **F-sec-2 / F-module-1**: PlayerAwareModule 8/33 구현(25 모듈 fallback), crime_scene 3 모듈 private state broadcast 위험 → **PR-2**
3. **F-sec-3**: voice mock provider token 평문 zerolog 출력(`feedback_ws_token_query` 규칙 위반) → **PR-2 또는 독립 hotfix**
4. **F-sec-4**: auth/admin/review 경로 auditlog 0건, session_id only schema → user_id 컬럼 필요 → **PR-6**

### 아키텍처 P0 (3건)
5. **F-ws-1**: `phase:entered` ↔ `game:phase:change` 3자 drift → phase 전환 UI 미반영 silent fail → **PR-1**
6. **F-ws-2**: `game:start`/`game:end` emitter 프로덕션 코드 부재(단위 테스트만) → **PR-1**
7. **F-module-1**: crime_scene 3 모듈 PlayerAware 미구현(C-2와 중첩, PR-2로 흡수)

### 관측/접근성 P0 (2건)
8. **F-perf-1**: `infra/otel`·`sentry`·`storage` 0% 커버리지 — 관측 레이어 동작 증명 부재 → **PR-5**
9. **F-a11y-3**: `outline-none` 57건에 `focus-visible` 없음 — WCAG 2.4.7 Focus Visible 명백 실패 → **독립 hotfix PR**

~~**F-a11y-1** (@jittda/ui 0/278)~~ **REMOVED** — 사용자 확정: @jittda/ui는 이 프로젝트 의존성 아님(타 프로젝트 jittda-frontend-hub 전용). v3 실제 스택 = Tailwind 4 직접 사용.

## P1 (52건, 이번 분기)

### 큰 덩어리 (3+건 묶음 P1)
- **파일/함수 크기 리밋 누적**: Go 500+ 10건 + 함수 80+ 6건 + TS 400+ 3건 (C-4, PR-4)
- **Coverage gate 부재**: Go 75% warn-only + Frontend 0 threshold + 0% 9 패키지 (C-5, PR-5)
- **Store 3-layer 경계 위반**: Connection↔Domain 직접 mutation, .getState() 16건, gameMessageHandlers vs useGameSync 중복 (C-7, PR-7)
- **Module Factory sessionId 누락**: 세션간 state 유출 위험 (C-8, PR-8)
- **WS payload 드리프트**: camelCase/snake_case 혼재, clue dot-case 13+ 이벤트, session:player:joined 엇갈림 (C-1에 흡수)
- **WCAG 미자동화**: axe/a11y spec 0건, aria-label 41% 커버리지, hex 22건 하드코딩
- **문서 drift**: module-spec "29" vs 33, BaseModule 임베드 패턴 부재, context.md 9%, MEMORY 2중화

### 개별 P1 (샘플)
- mockgen 0건(수동 1건만) — 규약 재확인
- t.Parallel() 채택률 0.5% — race 효과 반감
- EventBus O(N) fan-out, WS 브로드캐스트 O(N)
- goroutine context 전파 단절(SessionLifecycleListener)
- auth/middleware 커버리지 11.6%/35.3%
- `hydrateFromSnapshot` dead code

## P2 (28건, 백로그)
- pprof endpoint 미등록·보호 없음
- OTel 샘플 레이트 하드코딩
- Zustand selector shallow 미사용
- lazy routing 실효성 미검증
- 이미지 lazy loading 미적용
- social service 759줄 단일 파일
- `httputil/json.go` log.Printf 잔재
- Vitest coverage threshold 부재
- 승리 조건(WinChecker) 4/33 분산
- PhaseHookModule vs PhaseReactor 이중성
- …

## Metrics 롤업

### 코드 규모
- Go: 199 파일 / 38,284줄 / 500+ 초과 10(수동)
- Frontend: 331 파일 / 35,745줄 / 400+ 초과 3
- 모듈 33개 / 8 카테고리 / 총 10,057줄

### 테스트
- Go: 988 테스트 / 117 파일 / 평균 44.6% 커버리지 / 0% 9 패키지
- Vitest: 108 파일 / 1034 테스트 / coverage threshold 0
- E2E Playwright: 12 spec / 68 테스트 / skip 35 (21 gap)
- mockgen 0건, testcontainers 3 파일, @flaky 태그 0건

### WS 3자 일치율
- envelope 60+ 중 3자 완전 일치 **1건** (<4%)
- MSW 커버리지 ~4/60+
- Phase 17.5·18.0·18.1·18.6 반복 회귀 근거

### 설계 문서
- module-spec 29 vs 실측 33 (+4 drift)
- `BaseModule` 임베드 패턴 코드 부재 (engine.Module 인터페이스로 수렴)
- Phase 후속 39건 이월, context.md 2/23(9%) 작성
- MEMORY repo 4 vs user 34 파일

## 한계 (정적 관찰 범위 밖)
- **실행 부하 프로파일링 없음**: pprof/flamegraph 미수집 — EventBus/WS fan-out·goroutine leak은 "잠재 리스크" 수준
- **렌더링 지표 없음**: LCP/CLS/INP 미측정 — 이미지 lazy·Suspense 실효성 정적 추정만
- **WCAG 대비값 실측 불가**: 렌더 환경 부재 — 정적 hex/semantic token 카운트만
- **프로덕션 로그 볼륨·Sentry 실제 수신 미확인**: zerolog S/N 정적 분석만
- **Discord webhook 실알림 도달 미검증**(Option B smoke는 workflow_dispatch만, 알림 path는 push/schedule만 발동)
- **18.8 observation 3일 green 대기 중**: real-backend E2E 안정성 신뢰도 부분적

## 지침
- P0 10건 중 7건이 **PR-1 ~ PR-8** 8 PR로 흡수. 나머지 3건(P0 a11y 1건 + voice token 1건 + @jittda/ui 0% 1건)은 독립 PR 또는 Phase 20 이관.
- 실행 순서: `phase19-backlog.md` 참조.
- Open decisions(사용자·architect 판단 필요) 4건: WS naming SSOT / @jittda/ui 마이그레이션 스코프 / mockgen 규약 재확인 / MEMORY canonical 결정.

## 다음 단계
1. 본 executive-summary + phase19-backlog를 PR #69에 포함
2. 사용자 검토
3. `/plan-finish` Phase 19 audit → `/plan-new` Phase 19 implementation(8 PR backlog 기반)
4. 18.8 observation 3일 누적 완료 시 병행 `/plan-finish` 18.8 → Phase 18.9(required 승격)
