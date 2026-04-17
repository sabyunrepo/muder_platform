# Phase 19 Backlog — PR 후보 + Wave 제안

> **생성**: W3c Synthesis (2026-04-17)
> **기반**: 9 audit drafts + advisor-consultations.md 8 cross-cutting
> **포맷**: `/plan-new` 입력 호환

## PR 후보 (8건)

### PR-1: WS Contract SSOT — envelope naming 표준화 + MSW 확장 + contract test CI
- **Scope**: `apps/server/internal/ws/envelope_catalog.go`, `apps/server/internal/ws/message.go`, `apps/server/internal/session/event_mapping.go`, `apps/web/src/mocks/handlers/**`, `apps/web/src/stores/gameMessageHandlers.ts`, `packages/shared/src/ws/types.ts`, `packages/ws-client/src/client.ts`, `.github/workflows/` (contract gate)
- **Depends on**: 없음 (먼저 실행)
- **Rationale**: C-1 / F-ws-1·2·3·4·5·6·7·12. 3자 일치율 <4%, Phase 17.5~18.6 반복 회귀 근절.
- **Size**: L (>2d)
- **Risk**: High (serialization tag 변경이 모든 WS handler에 전파)

### PR-2: PlayerAwareModule Mandatory — 엔진 레벨 강제 + crime_scene 3 구현 + 테스트 백필
- **Scope**: `apps/server/internal/module/crime_scene/{evidence,location,combination}/**`, `apps/server/internal/module/decision/{accusation,hidden_mission,voting}/**`, `apps/server/internal/engine/types.go`, `apps/server/internal/engine/snapshot_redaction_test.go`
- **Depends on**: 없음 (병렬 가능)
- **Rationale**: C-2 / F-module-1 P0 + F-sec-2 P0. Phase 18.1 B-2 redaction 반쪽 상태 해소. 25 모듈 fallback → 필수 구현 + 컴파일 타임 assertion + boot-fail gate.
- **Size**: L (>2d)
- **Risk**: Med (서버만, 테스트 확장)

### PR-3: HTTP Error Standardization — http.Error → apperror + linter
- **Scope**: `apps/server/internal/seo/**`, `apps/server/internal/infra/storage/local/**`, `apps/server/internal/ws/upgrade*`, `apps/server/internal/apperror/**`, `.golangci.yml` (depguard 룰)
- **Depends on**: 없음
- **Rationale**: C-3 / F-sec-1 P0 + F-go-1 P1(boundary→P0). 12 호출 지점 교체 + 재발 방지 컴파일 gate.
- **Size**: M (≤2d)
- **Risk**: Low

### PR-4: File Size Refactor Wave — Go 10 + TS 3 파일 분할
- **Scope**: `apps/server/internal/domain/social/service.go` (759→분할), `apps/server/internal/editor/handler.go` (26 endpoint 분할), `apps/server/internal/ws/hub.go` (lifecycle/broadcast 분리), `apps/server/internal/module/{progression/reading,decision/voting,decision/hidden_mission,cluedist/trade_clue,decision/accusation,crime_scene/combination}/**`, `apps/web/src/features/game/components/GameChat.tsx`, `apps/web/src/features/editor/api.ts`, `apps/web/src/features/social/components/FriendsList.tsx`
- **Depends on**: PR-1 (WS envelope 영향받는 파일)
- **Rationale**: C-4 / F-go-3·4 + F-react-1·3·4. CLAUDE.md hard limit 누적 위반 10+ 건.
- **Size**: L (>2d)
- **Risk**: Med (import 경로 대량 변경)

### PR-5: Coverage Gate Enforcement + 0% 패키지 전략
- **Scope**: `.github/workflows/ci.yml`, `apps/web/vitest.config.ts`, `apps/server/internal/infra/otel/**` (테스트 추가), `apps/server/internal/infra/sentry/**`, `apps/server/internal/infra/storage/**`, `apps/server/cmd/server/**`, `apps/server/internal/db/**`, `codecov.yml`
- **Depends on**: PR-3 (apperror 전환 후 측정 안정)
- **Rationale**: C-5 / F-test-1·5 + F-perf-1. Go 75% warn-only → hard fail, Frontend threshold 도입, 0% 9 패키지 중 infra 3건은 테스트 작성 / cmd/internal은 "intentionally excluded" 선언.
- **Size**: M (≤2d)
- **Risk**: High (기존 머지 워크플로우 차단 리스크, feature flag 필요)

### PR-6: Auditlog Expansion — schema + auth/admin/review 배선
- **Scope**: `apps/server/internal/db/migrations/**` (schema 변경: session_id NULLABLE + user_id column), `apps/server/internal/auditlog/**`, `apps/server/internal/domain/auth/service.go`, `apps/server/internal/admin/**`, `apps/server/internal/review/**`, 관련 테스트
- **Depends on**: 없음
- **Rationale**: C-6 / F-sec-4 P0. auth/admin/review handler 6+ 곳 auditlog.Log 주입, schema 확장, 단위 테스트.
- **Size**: L (>2d)
- **Risk**: Med (migration)

### PR-7: Zustand Action Unification — applyWsEvent + .getState() 제거
- **Scope**: `apps/web/src/stores/gameSessionStore.ts`, `apps/web/src/stores/gameMessageHandlers.ts`, `apps/web/src/hooks/useGameSync.ts`, `apps/web/src/stores/moduleStoreFactory.ts`, 관련 테스트
- **Depends on**: PR-1 (envelope 표준화 후 단일 reducer 경로로 통합 가능)
- **Rationale**: C-7 / F-react-5 + F-perf-7. Connection→Domain 이중 경로 통합, .getState() 16건 제거.
- **Size**: M (≤2d)
- **Risk**: Med (WS 이벤트 처리 버그 risk)

### PR-8: Module Cache Isolation — Factory key sessionId namespace
- **Scope**: `apps/web/src/stores/moduleStoreFactory.ts`, `apps/web/src/stores/gameSessionStore.ts` (resetGame 통합), 관련 테스트
- **Depends on**: PR-7 (Zustand action unification 이후)
- **Rationale**: C-8 / F-react-6. sessionId:moduleId 키 namespace + resetGame 연계 + dev warning. 서버 Factory 교차확인 필요(open decision).
- **Size**: S (≤4h)
- **Risk**: Low

---

## Open Decisions (사용자·architect 판단 대기)

1. **WS naming SSOT**: enum(프론트) vs backend emission 중 어느 쪽을 source of truth로 할지 (C-1)
2. **@jittda/ui 마이그레이션 스코프**: 전체 278 파일 일괄 vs Phase 19 core 5 페이지만 vs Phase 20 이관 (F-a11y-1 P0)
3. **mockgen 규약 재확인**: CLAUDE.md "mockgen + testcontainers-go" 규약을 (A) 재도입 vs (B) 문서 수정(integration 우선) (F-test-4)
4. **MEMORY canonical 결정**: repo `memory/` 4 파일 vs user `.claude/projects/...` 34 파일 중 단일 진실 소스 (F-docs-5)

---

## Wave 제안 (3 Wave, 총 8 PR)

### Wave 1 — Foundation Fixes (병렬 3)
> 의존 없음, 독립 실행 가능

- **PR-1 WS Contract SSOT** (L, High risk) — 아키텍처 기반, 후속 PR 여러 개가 의존
- **PR-3 HTTP Error Standardization** (M, Low risk)
- **PR-6 Auditlog Expansion** (L, Med risk, DB migration)

**Gate**: 3 PR main 머지 + contract test CI 녹색

### Wave 2 — Enforcement + Security (병렬 3)
> Wave 1 이후 (envelope 표준 + apperror 배선 완료 후 측정)

- **PR-2 PlayerAwareModule Mandatory** (L, Med) — 서버 redaction 완결
- **PR-5 Coverage Gate Enforcement** (M, High risk) — 75%/threshold 강제
- **PR-7 Zustand Action Unification** (M, Med) — PR-1 기반

**Gate**: 커버리지 Go 70%+ · Frontend 60%+ · redaction test 전 모듈 통과

### Wave 3 — Refactor + Cleanup (병렬 2)
> Wave 1·2 이후 (envelope·coverage 안정 상태)

- **PR-4 File Size Refactor Wave** (L, Med) — 13 파일 분할
- **PR-8 Module Cache Isolation** (S, Low) — PR-7 기반

**Gate**: 500+/400+ 파일 0건 · 세션 전환 E2E 테스트 추가

### 독립 / 차후
- **P0 F-a11y-1** (@jittda/ui 0/278): Wave 구조 밖, Phase 20 이관 또는 독립 PR 후속
- **P0 F-a11y-3** (outline-none 57): 독립 hotfix PR
- **P0 F-sec-3** (voice token 평문 로그): 독립 hotfix PR (1시간 내)
- **P2 백로그 28건**: Phase 20 이후 기술 부채 PR로 수렴

---

## 예상 리소스
- Wave 1: 3 PR 병렬 ≈ 3-4일
- Wave 2: 3 PR 병렬 ≈ 3-4일
- Wave 3: 2 PR 병렬 ≈ 2일
- 독립 hotfix: 1-2시간
- **Phase 19 총 기간**: 약 10-12 영업일 (병렬 실행 기준)

## 다음 액션
1. 사용자가 본 backlog 검토 + Open Decisions 4건 답변
2. `/plan-finish` Phase 19 audit (shadow) → `/plan-new` Phase 19 implementation
3. 18.8 observation 3일 누적 후 `/plan-finish` 18.8 → Phase 18.9(required 승격)와 병행 진행
