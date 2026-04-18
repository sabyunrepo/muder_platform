---
name: Phase 19 Platform Deep Audit — Implementation 진행 상황
description: 9 PR backlog 구현 단계. W0/W1 일부 완료. P0 4→2 해소 진행 중
type: project
---

# Phase 19 Implementation — 진행 로그

> **시작:** 2026-04-18 (commit b9cc4ba 기점)
> **기반:** Phase 19 Audit(PR #69 merged, 89 findings) + Delta audit(PR #82, 2026-04-18)
> **정책:** CI admin-skip (2026-05-01까지) · graphify refresh D 정책

## 완료 PR

### W0 (선행)
- **PR-0 MEMORY Canonical Migration** ✅ #84 (f456167, 2026-04-18)
  - user home 53 파일 repo `memory/` 복원, MEMORY.md 인덱스 최신화
  - Sub-task 5 (user home archive)는 안전상 원본 유지
  - Sub-task 4 (QMD path 재인덱싱)는 사용자 수동 작업 남음

### 독립 hotfix
- **F-sec-3 voice token 평문 로그** ✅ #83 (b9cc4ba, 2026-04-18)
  - `apps/server/internal/domain/voice/provider.go` mockProvider.GenerateToken에서 token 필드 로깅 제거
  - **Phase 19 F-05 P0 1건 해소**

### W1 (진행 중)
- **PR-3 HTTP Error Standardization** ✅ #85 (c817256, 2026-04-18)
  - `http.Error` 12건 → `apperror.WriteError`
  - `.golangci.yml` forbidigo rule 추가 (재발 방지)
  - `ErrMethodNotAllowed` + `MethodNotAllowed(detail)` helper 추가
  - **Phase 19 F-05 P0 1건 해소 (F-sec-1)**

- **PR-1 WS Contract SSOT** ✅ #86 (2026-04-18, `feat/phase-19-pr-1-ws-ssot` squash-merged)
  - Go Catalog 130 events SSOT + wsgen codegen (v1.5 α tygo-like)
  - packages/shared/src/ws/types.generated.ts 자동 생성
  - ws-client AUTH 제거 (쿼리 토큰 정책), 프론트 enum 정합
  - CI WS contract drift gate
  - PR-9 (WS Auth) + PR-10 (Runtime validation) 신설

- **PR-6 Auditlog Expansion** ✅ #87 (2026-04-18, squash-merged)
  - 00026_auditlog_expansion.sql — session_id/seq NULLABLE + user_id + CHECK identity_required
  - sqlc: AppendAuditEvent + AppendUserAuditEvent + ListByUser
  - auditlog.AuditEvent에 UserID + HasSession/HasUser + Validate 확장
  - Store.Append 분기(session vs user), pgtype 변환 헬퍼
  - auth service.go: Register/Login(succ+fail)/Logout/DeleteAccount/OAuthCallback 배선
  - admin handler: UpdateUserRole/ForceUnpublishTheme/ForceCloseRoom
  - admin review_handler: Approve/Reject/Suspend/SetTrustedCreator
  - editor clue_edge_handler: ReplaceClueEdges (D-SEC-1)
  - main.go: auditlog.DBLogger 정식 wiring (Start/Stop)
  - 새 AuditAction 상수 14종 추가
  - **Phase 19 F-05 P0 F-sec-4 해소**

- **PR-7 Zustand Action Unification** ✅ #88 (2026-04-18, squash-merged, ccc1c16)
  - Dead code 삭제: `features/game/hooks/useGameSession.ts` + `stores/gameMessageHandlers.ts` (둘 다 호출처 0)
  - `useGameSync.ts` 리팩터: `useGameStore.getState()` × 6 → Zustand selector로 action bind
  - WS 경로 `.getState()` 8건 → 2건 (잔여 2건은 PR-8 Module Cache Isolation 대상)
  - 3 files · +28 / −214 (-186 net)
  - **F-react-5 P1 해소**

### W3 (신규 완료 2026-04-18)
- **PR-8 Module Cache Isolation** ✅ #91 (34e952f, 2026-04-18, squash-merged)
  - cache key `moduleId` → `${sessionId}:${moduleId}` namespace
  - `clearBySessionId(sessionId)` + `resetGame` 훅업 (세션 종료 시 해당 세션 모듈 store teardown)
  - `useModuleStore` 자동 sessionId 구독 + optional `sessionIdOverride`
  - `useGameSync` MODULE_STATE/MODULE_EVENT 핸들러 sessionId 전달
  - DEV-only `console.warn` (프로덕션 tree-shake)
  - 5 files · 25 신규 tests / 1047 total pass
  - 코드리뷰: **APPROVE-WITH-NITS** — circular import (moduleStoreFactory ↔ gameSessionStore) follow-up로 cleanup 함수 추출 권장
  - **F-react-6 P1 해소**

### W2 잔여 (신규 완료 2026-04-18)
- **PR-2a Engine Gate + PublicStateMarker** ✅ #97 (bacd802, 2026-04-18, squash-merged)
  - `engine/types.go` — `PublicStateModule` sentinel + `PublicStateMarker` helper (외부 위조 방지)
  - `engine/registry.go` — `assertModuleContract` + `Register()` panic gate + `MMP_PLAYERAWARE_STRICT` env
  - `engine/factory.go` — `BuildModules()` runtime gate
  - `engine/gate_test.go` NEW — 10 tests
  - 33 모듈 분류: PlayerAware 8 / PublicStateMarker 13 / Stub 12 (PR-2b 실구현)
  - gm_control → PublicStateMarker (BuildState 공개 필드만, snapshot_send 필터 없음)
  - 39 files, +653 / -77, 전 패키지 go test ok, vet clean
  - 설계: `refs/pr-2/pr-2a-engine-gate.md`
  - **F-sec-2 gate 해소** (실구현은 PR-2b)

### W3 PR-4 파일 분할 (신규 완료 2026-04-18)
- **PR-4 설계 문서** ✅ #99 (8c67fbc) — pr-4-split-design + 4 refs + backlog PR-4a/4b 재기입
- **PR-4b TS 파일 분할** ✅ #100 (e754654) — editor/api.ts 428 + GameChat.tsx 423 + FriendsList.tsx 415 → 디렉터리 배럴 구조
  - 3 파일 → 24 파일 · 모든 신규 ≤191줄, JSX ≤121줄
  - 1047 tests pass · bundle size +0.27% (budget ≤3%)
  - **F-react-3·4 해소**
- **PR-4a Go 파일 분할** ✅ #102 (be2d0a6) — 6 모듈 디렉터리 승격 + 3 인프라 분할 + tally.go 추출
  - 모듈 승격: reading 652/voting 639/hidden_mission 559/combination 543/trade_clue 532/accusation 515
  - 인프라 분할: social/service 759→43 / ws/hub 649→175 / editor/service 505→185
  - accusation.handleAccusationVote 101줄 → tally.go 순수함수 추출 (**F-go-4 1건 해소**)
  - 5 커밋 · 전 패키지 go test ok · vet clean · build clean
  - **F-go-3 해소 (in-scope 9 파일 모두 ≤500)**

### Follow-up 완료 (2026-04-18)
- **PR-11 Store Cleanup Decoupling** ✅ #95 (bf3c3d9) — moduleStoreFactory ↔ gameSessionStore 순환 import 해소
- **F-a11y-4 residual cleanup** ✅ #94 (46057ea) — bare outline-none 9건 + 체크박스 focus:ring 7건 정리
- **PR-2 설계 문서 정리** ✅ #96 (0ed03a7) — pr-2-split-design + 5 refs + inventory 교정 + backlog 3엔트리 재기입
- **PR-2a skill + CLAUDE.md 동기화** ✅ #101 (e2e4478) — mmp-module-factory SKILL §6 PlayerAware 게이트 추가 + CLAUDE.md 모듈 시스템 + 하네스 변경 이력

### 독립 hotfix (신규 완료 2026-04-18)
- **F-a11y-3 focus-visible WCAG 2.4.7** ✅ #92 (049277f, 2026-04-18, squash-merged)
  - `outline-none` 60 occurrence / 38 파일 → 34 파일 수정 (4파일 기존 정합)
  - 패턴: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900`
  - 변형: 폼 인풋(이중 단서) / purple 테마(WhisperTargetPicker·GameChat) / ring-inset(StoryTab·AdvancedTab·ActionListEditor) / ring-offset-2(ModulesSubTab 토글)
  - 34 files · +54 / -54 · 1039 tests pass · regression 0
  - 코드리뷰: **APPROVE** — residual bare `outline-none` 7건 / 체크박스 `focus:ring` 미변환은 범위 외 follow-up
  - **F-a11y-3 P0 해소**

### W3 (신규 완료 2026-04-18 밤 세션)
- **PR-2b 12 모듈 BuildStateFor 실구현** ✅ #104 (a93cff2, 2026-04-18 admin squash-merge)
  - 7 커밋 체인: helpers → evidence+location → accusation → text_chat+group_chat → exploration4+reading → clue_interaction → coverage lint + cluedist 독립 path
  - 11 모듈 real per-player redaction (evidence, location, accusation, group_chat, clue_interaction, exploration 4, 단 text_chat/reading은 broadcast 독립 path)
  - engine.FilterByPlayer / FilterByPlayerStringKey / FilterByKeySet 제네릭 helper 3종
  - combination은 PR-2c 위임 (lint allowlist)
  - cluedist 3 (round/conditional/timed) PR-2a "구현됨" 오판정 교정 — 실질 broadcast → 독립 snapshot path
  - `scripts/check-playeraware-coverage.sh` 신규 + CI ci.yml go-check step 추가
  - 33 신규 테스트 + helper 7 케이스 · 전 Go race test green · vet clean
  - **F-03 실구현 (evidence/location) + F-sec-2 실구현 (11/12) 해소**. combination PR-2c 머지 후 F-03 7/7 완결.

## 남은 PR

### W3 차기 착수
- **PR-2c craftedAsClueMap redaction** (S-M, Low) — D-MO-1 단독. `apps/server/internal/module/crime_scene/combination/state.go` BuildStateFor를 real per-player redaction으로 교체. 설계: `docs/plans/2026-04-17-platform-deep-audit/refs/pr-2/pr-2c-crafted-redaction.md`
  - PR-2b 머지 완료 → stub 충돌 회피 가능
  - combination은 현재 `scripts/check-playeraware-coverage.sh` ALLOW_STUB 예외 — PR-2c 머지 시 제거

### W2 잔여
- **PR-5 Coverage Gate + mockgen 재도입** (XL, High) — editor -2.9%p 회귀 복구, 3분할 권장 ⏳

### Follow-up 신설 (2026-04-18)
- **PR-9 WS Auth Protocol** (L, Med) — IDENTIFY/RESUME/CHALLENGE/REVOKE. 쿼리 토큰 한계 보완. PR-1 이후
- **PR-10 Runtime Payload Validation** (L, Med) — Go struct → JSON Schema → zod, 서버 송신 validator. PR-1 이후

### Pre-existing tech debt (PR-4a scope 외)
- `editor/media_service.go` (653줄) / `editor/handler.go` (624줄) — 별도 파일 분할 후속 PR

## P0 해소 진행률

| # | Finding | 상태 | PR |
|---|---------|------|-----|
| F-03 | crime_scene PlayerAware | 🟡 evidence/location 해소 · combination PR-2c | PR-2a (#97) + PR-2b (#104) → PR-2c |
| F-sec-1 | RFC 9457 우회 12건 | ✅ 해소 | PR-3 (#85) |
| F-sec-2 | PlayerAware 25/33 fallback | ✅ gate + 11 모듈 실구현 · combination PR-2c | PR-2a (#97) + PR-2b (#104) → PR-2c |
| F-sec-3 | voice token 평문 로그 | ✅ 해소 | hotfix (#83) |
| F-sec-4 | auditlog 부재 | ✅ 해소 | PR-6 (#87) |
| D-MO-1 | craftedAsClueMap (delta) | **미해소** | PR-2c 예정 |
| F-a11y-3 | outline-none 60 | ✅ 해소 | hotfix (#92) |

**6/7 해소 (~86%)** — PR-2b (#104)로 F-03 evidence/location + F-sec-2 11모듈 실구현 완료. combination(PR-2c) 머지 후 7/7 완결.

## 2026-04-18 세션 총결 (12 PR 머지, #91~#102)

| # | PR | 효과 |
|---|---|---|
| #91 | PR-8 Module Cache Isolation | F-react-6 P1 |
| #92 | F-a11y-3 focus-visible | WCAG 2.4.7 (60건) |
| #93 | progress sync 1차 | — |
| #94 | F-a11y-4 residual cleanup | outline-none 9 + 체크박스 7 |
| #95 | PR-11 순환 import cleanup | PR-8 review HIGH |
| #96 | PR-2 3분할 설계 + inventory 교정 | 설계 SSOT |
| #97 | **PR-2a Engine Gate + PublicStateMarker** | **F-sec-2 gate 차단** |
| #98 | progress sync 2차 | — |
| #99 | PR-4 파일 분할 설계 + backlog 재기입 | — |
| #100 | **PR-4b TS 파일 분할** | **F-react-3·4 해소** |
| #101 | PR-2a skill + CLAUDE.md 동기화 | 규약 반영 |
| #102 | **PR-4a Go 파일 분할** | **F-go-3·4 해소** |

**핵심 성과**:
- P0 5/7 해소 (71%) — F-sec-1/2(gate)/3/4, F-a11y-3
- P1 F-react-3·4·6 해소
- F-go-3·4 해소 (Go 파일 크기 한도)
- PR-2a gate로 F-sec-2 재발 원천 차단 (compile + boot-fail)
- in-scope 9 Go 파일 모두 ≤500줄, TS 3 파일 모두 ≤191줄

## 2026-04-18 밤 세션 총결

| # | PR | 효과 |
|---|---|---|
| #104 | **PR-2b 12 모듈 BuildStateFor 실구현** | **F-03 evidence/location + F-sec-2 11/12 해소** (combination PR-2c 남음) |

누적 P0: 6/7 (86%). 다음 PR-2c 머지 시 7/7.

## 다음 세션 재개 방법

```bash
cd /Users/sabyun/goinfre/muder_platform
claude
/plan-resume
# 최우선 목표: PR-2c craftedAsClueMap redaction (S-M Low risk) — F-03 + D-MO-1 완결
#   - 대상: apps/server/internal/module/crime_scene/combination/state.go
#   - 설계: docs/plans/2026-04-17-platform-deep-audit/refs/pr-2/pr-2c-crafted-redaction.md
#   - 선행 완료: PR-2b (#104) — stub 충돌 회피 완료
#
# 작업 순서:
#   1. combination/state.go BuildStateFor stub → real per-player redaction
#      - completed/derived/collected map을 caller 엔트리만 유지
#      - craftedAsClueMap redaction (D-MO-1) — 핵심
#   2. combination_test.go에 BuildStateFor 3 케이스 추가 (CallerOnly / NoEntry / NoCrossLeak)
#   3. scripts/check-playeraware-coverage.sh의 ALLOW_STUB 배열에서 combination 경로 제거
#   4. engine/build_state_for_test.go 회귀 확인
#   5. 전 race test + coverage lint + PR 생성 + admin 머지
#
# PR-2c 이후: PR-5 Coverage+mockgen (XL High)
# 또는 PR-9 WS Auth / PR-10 Runtime validation / editor/handler 624·media_service 653 분할
```

## 참조
- active-plan: `.claude/active-plan.json`
- backlog: `docs/plans/2026-04-17-platform-deep-audit/refs/phase19-backlog.md`
- delta audit: `docs/plans/2026-04-18-architecture-audit-delta/`
