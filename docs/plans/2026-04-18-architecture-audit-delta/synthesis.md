# Architecture Audit Delta — Synthesis (Phase 19 → 20)

> **기간:** 2026-04-17 (Phase 19 PR #69) → 2026-04-18 (Phase 20 + graphify 툴링)
> **방법:** 5 전문가 subagent 병렬 delta 재검토 + graphify 구조 분석
> **산출물:** `refs/{go-backend,react,module,test,security}-delta.md` + `refs/graphify-insights.md`

## Executive Summary

**Phase 19 backlog의 해소 진행률은 매우 낮습니다 (≈ 2%).** Phase 20이 단서·장소 승격 기능에 집중했기 때문이며, 보안·모듈·테스트 P0/P1은 거의 그대로입니다. 대신 Phase 20 신규 코드는 **새 규약(AppError + 소유권 가드)을 일관되게 준수**해 부채 확장은 제한적입니다. graphify로 새로 드러난 3건의 구조적 이슈(mutex 허브, HTTP 에러 이중화, orphan 페이지)가 Phase 19 backlog에 **증거 보강** 효과.

**총 신규 Finding 26건:** P0 **1건** · P1 **약 9건** · P2 **13건** · Info **3건**.

## Phase 19 해소 진행률

| 영역 | Phase 19 count | Delta 상태 | 주요 잔존 P0/P1 |
|------|---------------|-----------|-----------------|
| F-01 go-backend (8) | R:1 S:2 U:5 | AppError 우회 12건 3파일 그대로 |
| F-02 react-frontend (10) | R:0 부분:1 U:9 | GameChat 이중상태·Connection↔Domain 경계 |
| F-03 module-architect (6, **P0:1**) | R:0 U:5 | **crime_scene PlayerAware 미해소** + D-MO-1 신규 P0 확장 |
| F-04 test-engineer (10) | R:0 U:10 + **coverage 회귀** | 0% 9패키지 / mockgen 결정 미이행 / editor -2.9%p |
| F-05 security (12, **P0:4**) | R:0 U:12 | **P0 4건 전부 미해소** (RFC9457/PlayerAware/token/auditlog) |

**핵심:** Phase 19 backlog 9 PR + 독립 hotfix 2건은 사실상 **미착수 상태**로 확인.

## 신규 Findings 집계

### P0 (1건)
- **D-MO-1** — `craftedAsClueMap` per-player derived set 도입으로 Phase 19 F-03 PlayerAware **범위 확장**. redaction scope 재정의 필요.

### P1 (≈9건)
- **D-SEC-1** — 신규 editor clue_edge/clue_relation handler에 `auditlog.Log` 호출 0건 (F-sec-4 연장)
- **D-MO-2** — `GameState.CurrentRound` 도입이 `ModuleDeps`/Interfaces에 반영 안 됨 → 모듈 규약 drift
- **D-RF-N1** — `apps/web/src/features/editor/api.ts` 428/400 잔존 (F-react-3 부분 해소)
- **D-RF-N3** — `useClueEdgeData` 문자열 매칭 (`err.message.includes("EDGE_CYCLE_DETECTED")`) → `ApiHttpError.code` 미활용
- **D-TE-1** — `domain/editor` 커버리지 **19.6% → 16.7% 회귀**
- **GI-1** — `unlock()` 301 + `Lock` 300 = 601 edges 집중 → mutex hotspot, Session Actor 경계 검토 필요
- **GI-2** — `WriteError()` 153 + `writeJSON()` 119 병존 → F-sec-1 (RFC9457 우회)의 **구조적 뿌리**
- **GI-8** — `CLAUDE.md` Go 규칙 ↔ `apperror.go` 엣지 약함 → linter rule 부재
- **D-GB-? (신규 500+ crossing)** — `combination.go` 533, `editor/service.go` 505 (Phase 19 PR-4 scope 확장)

### P2 (≈13건)
- **D-GB-2~5** — 파일 크기 + positive split pattern + advisory
- **D-SEC-2~6** — ReplaceClueEdges TOCTOU / edge members fan-out / RLS 부재 / snapshot × clue_edge_groups 등
- **D-TE-2~4** — mockgen, E2E skip 패턴, fixture 비분리
- **D-MO-3** — ConfigSchema 비표준 패턴 (F-03 잔존)
- **D-RF-N2, N5** — UI primitive wrapper 공백 / `role="button"` div 안 `<button>` 중첩 a11y
- **GI-3/4/5/7** — newTestDeps 허브 / 페이지 thin community / Audio·Video 이중화

### Info (3건)
- D-RF-N4 (exhaustive-deps suppress)
- D-RF-N6 (optimistic rollback 중복 + 토스트 drift)
- D-MO-4 (Phase 20 긍정 패턴)

## 긍정 신호 (Phase 20 승격으로 확인)

- **Clue Discovery Pipeline Hyperedge** 명시화 (graphify EXTRACTED 0.85) — Graph.Resolve → FilterByRound → ComputeVisible
- **owned-theme guard 공유 패턴** (clue + location + validation 3개 서비스) hyperedge 확인
- **신규 handler 100% AppError 사용** (3계층 경계 일관)
- **sqlc 파라미터 바인딩 100%** (SQL injection 위험 zero)
- **`http.MaxBytesReader` 1MB cap** 적용 (DoS 방지)
- **BaseAPI/api.* 싱글턴 경유 100%** (직접 `fetch(` 0건)

## Phase 19 Backlog 영향 (scope 업데이트)

| PR | Phase 19 Size | 수정 Size | 변경 사유 |
|----|---------------|----------|----------|
| PR-0 MEMORY Migration | S | **S** | 변동 없음 |
| PR-1 WS Contract SSOT | L | **L** | 변동 없음 (delta scope 밖) |
| PR-2 PlayerAware Mandatory | L | **XL** | D-MO-1 craftedAsClueMap + Phase 20 CurrentRound drift 통합 |
| PR-3 HTTP Error Standardization | M | **M (priority ↑)** | GI-2 구조적 증거 + 우선순위 상향 |
| PR-4 File Size Refactor | L | **L+** | combination.go(533), editor/service.go(505), editor/api.ts(428) 편입 (Go 10→12 / TS 3→4) |
| PR-5 Coverage Gate + mockgen | L | **XL** | editor -2.9%p 회귀 복구 + fixture 분리(GI-4) + mockgen 재도입 |
| PR-6 Auditlog Expansion | L | **L+** | editor clue_edge/clue_relation handler 추가 (D-SEC-1) |
| PR-7 Zustand Action Unification | M | **M** | 변동 없음 |
| PR-8 Module Cache Isolation | S | **S** | 변동 없음 |
| 독립: focus-visible | S | **S** | 변동 없음 |
| 독립: voice token 로그 | S | **S** | F-sec-3 미해소 그대로 |

## 신규 Phase 21 후보 (Phase 19 backlog 밖)

- **D-PERF-MUTEX (P1)** — `unlock`/`Lock` 601 edges 집중 점검 + Session Actor 경계 재확인 (GI-1)
- **D-DEV-RULE (P1)** — CLAUDE.md 규칙 ↔ 코드 linter 자동화 (GI-8). go vet custom check for `writeJSON` 직접 호출.
- **D-ARCH-ORPHAN (P2)** — Admin/Creator 페이지 thin community 정리 (GI-5). dead code 감사.
- **D-ARCH-MEDIA (P2)** — Audio/Video Orchestrator 통합 (GI-7)

## 결론 & 다음 액션

1. **Phase 19 backlog가 여전히 유효**하며 대부분 scope 확장됨. Delta audit 자체가 backlog 폐기 신호 아님.
2. **가장 시급:** F-05 security P0 4건 + D-MO-1/D-SEC-1. W1 우선 착수 권장 (세부는 `priority-update.md`).
3. **Phase 20 긍정 패턴은 Phase 21 규약 예시**로 활용 — editor clue_edge handler를 다른 도메인 ref로.
4. **graphify 기반 3건 신규 Phase 21 후보**는 Phase 19 PR 완료 후 별도 wave로 편성.
5. 머지 후 Phase 19 implementation을 `/plan-new phase-21` 또는 `/plan-start docs/plans/2026-04-17-platform-deep-audit/`으로 착수.
