# Backlog Source — 원본 매핑

> Phase 19 audit 산출물 중 본 phase가 실행하는 PR과 이월된 PR의 대응 관계.

## 원본 문서

- **Phase 19 Executive Summary**: `docs/plans/2026-04-17-platform-deep-audit/refs/executive-summary.md`
- **Phase 19 Backlog (11 PR)**: `docs/plans/2026-04-17-platform-deep-audit/refs/phase19-backlog.md`
- **Phase 19 Specialists (9 drafts)**: `docs/plans/2026-04-17-platform-deep-audit/refs/specialists/01~09-*.md`
- **Advisor Consultations**: `docs/plans/2026-04-17-platform-deep-audit/refs/advisor-consultations.md`
- **Delta Audit Priority Update**: `docs/plans/2026-04-18-architecture-audit-delta/priority-update.md`
- **Delta Audit Synthesis**: `docs/plans/2026-04-18-architecture-audit-delta/synthesis.md`
- **graphify insights**: `docs/plans/2026-04-18-architecture-audit-delta/refs/graphify-insights.md`

## PR 상태 매핑

| PR | 원 backlog 상태 | 본 phase | 메모 |
|----|----------------|---------|------|
| PR-0 MEMORY Canonical | 미착수 | ✅ W0 | 선행 필수 |
| PR-1 WS Contract SSOT | 미착수 | ✅ W1 | tygo v1.5 + catalog alias |
| PR-2a Engine Gate | 머지 | — | Phase 19 #101 `e2e4478` |
| PR-2b 13 Module Backfill | 머지 | — | Phase 19 #104 `a93cff2` |
| PR-2c craftedAsClueMap redaction | 머지 + hotfix | — | Phase 19 #107+#108 |
| PR-3 HTTP Error Standardization | 미착수 | ✅ W1 | depguard 룰 |
| PR-4a Go 분할 | 머지 | — | Phase 19 #102 `be2d0a6` |
| PR-4b TS 분할 | 머지 | — | Phase 19 #100 `e754654` |
| PR-5 Coverage Gate + mockgen | 미착수 | ✅ W2 (3분할) | XL → 5a/b/c |
| PR-6 Auditlog Expansion | 미착수 | ✅ W1 | editor clue_edge 흡수 (D-SEC-1) |
| PR-7 Zustand Action Unification | 미착수 | ✅ W2 | PR-1 의존 |
| PR-8 Module Cache Isolation | 미착수 | ✅ W3 | PR-7 의존 |
| PR-9 WS Auth Protocol | 미착수 | ✅ W4 | 신규 (PR-1 분리 결정) |
| PR-10 Runtime Payload Validation | 미착수 | ✅ W4 | 신규 (PR-1 v1.5 분리) |
| H-1 voice token 로그 | 미착수 | ✅ W1-hotfix | F-sec-3 |
| H-2 focus-visible 57건 | 미착수 | ✅ W3-hotfix | F-a11y-3 |

## Phase 21 이월 (graphify-driven)

| PR | 근거 | Size | Severity |
|----|------|------|---------|
| PR-11 Mutex Hotspot Audit | GI-1 (`unlock`/`Lock` 601 edges) | M | P1 |
| PR-12 CLAUDE.md ↔ code Linter | GI-8 (custom go vet rule) | S | P1 |
| PR-13 Admin/Creator Page Dead-code | GI-5 (thin community) | M | P2 |
| PR-14 Audio/Video Orchestrator 통합 | GI-7 (MediaOrchestrator 추출) | L | P2 |

→ `/plan-new phase-21-graphify-driven` 가이드: Phase 19 Residual 종결 직후.

## Resolved Decisions (Phase 19 확정 유지)

1. ✅ WS naming SSOT = 서버 기준 (`envelope_catalog.go`)
2. ✅ @jittda/ui 감사 제외 (타 프로젝트 의존성)
3. ✅ mockgen 규약 유지 → PR-5a에서 재도입
4. ✅ MEMORY canonical = repo `memory/` → PR-0에서 migration
5. ✅ WS 표기법 = 점 표기 (`<category>.<action>`) — Legacy 콜론 121건 Alias 보존
6. ✅ WS AUTH = PR-9로 분리
7. ✅ Payload schema = v1.5 tygo + PR-10 런타임 검증 분리

## 비범위 (본 phase 제외)

- **P2 백로그 28건** — Phase 22+ 기술 부채 묶음
- **Phase 18.8 observation** — 이미 종결 (stash → /plan-finish 필요 시 별도 처리)
