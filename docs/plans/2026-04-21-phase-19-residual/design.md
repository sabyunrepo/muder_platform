# Phase 19 Residual — 감사 backlog 잔여 PR 실행 (2026-04-21)

> **목적**: Phase 19 Platform Deep Audit(2026-04-17)와 2026-04-18 Architecture Audit Delta에서 도출된 11 PR 중, Phase 19 implementation 시점에 미착수된 잔여 7 PR + 신규 추가된 WS Auth/Payload Validation 2 PR 실행.

## 배경

### 선행 완료
- **Phase 19 audit** (2026-04-17) — archived, commit `68f0358`
  - 90 finding (P0:10 / P1:52 / P2:28)
  - 11 PR backlog 산출 (`refs/phase19-backlog.md`)
- **Phase 19 implementation** (2026-04-18) — archived, commit `099a096`
  - 실제 머지: PR-2a/b/c (PlayerAware) + PR-4a/b (File size)
  - 잔여 7 PR 미착수
- **Phase 19.1 review follow-ups** (2026-04-18) — archived, commit `4fe835f`
  - W1 3 PR: strict env 제거 / coverage lint AST / PeerLeakAssert helper
- **Architecture Audit Delta** (2026-04-18) — `docs/plans/2026-04-18-architecture-audit-delta/`
  - Phase 19 → 20 delta 재검증, PR 우선순위 재편
  - `priority-update.md`가 본 phase의 **실행 source of truth**

### 현재 상태
- `.claude/active-plan.json` = `{ "active": null }`
- 오늘 날짜: 2026-04-21 (최근 머지 #118 `chore(plan): /plan-* 커맨드 slim`)

## 범위

### 포함 (9 PR + 2 hotfix)

| Wave | PR | 제목 | Size | 의존 |
|------|----|------|------|------|
| W0 | PR-0 | MEMORY Canonical Migration (user home → repo) | S | — |
| W1 | PR-3 | HTTP Error Standardization (http.Error → apperror) | M | W0 |
| W1 | PR-1 | WS Contract SSOT (서버 기준 + tygo codegen) | L+ | W0 |
| W1 | PR-6 | Auditlog Expansion (schema + editor clue_edge 흡수) | L+ | W0 |
| W1-hotfix | H-1 | voice token 평문 로그 제거 | XS | — |
| W2 | PR-5 | Coverage Gate + mockgen 재도입 (5a/5b/5c 3분할) | XL | PR-3 |
| W2 | PR-7 | Zustand Action Unification | M | PR-1 |
| W3 | PR-8 | Module Cache Isolation | S | PR-7 |
| W3-hotfix | H-2 | focus-visible 57건 (WCAG 2.4.7) | S | — |
| W4 | PR-9 | WS Auth Protocol (IDENTIFY/RESUME/CHALLENGE/REVOKE) | L | PR-1 |
| W4 | PR-10 | Runtime Payload Validation (zod/ajv) | L | PR-1 |

### 비범위
- **PR-2a/b/c, PR-4a/b** — Phase 19 implementation에서 이미 머지
- **graphify-driven PR-11/12** (Mutex Hotspot / CLAUDE.md ↔ code Linter / Admin Dead-code / Audio-Video Orchestrator) — priority-update.md에서 "Phase 21 후보"로 분류. 본 phase에서 분리.
- **P2 백로그 28건** — Phase 22+ 기술 부채 묶음

## Wave 구조

```
W0 (직렬)        W1 (병렬 3 + hotfix)              W2 (순차)            W3 (병렬 2 + hotfix)   W4 (병렬 2)
PR-0  ─────────► PR-3 ─┐                           ┌► PR-5 ──► PR-7   ┌► PR-8               PR-9
                 PR-1 ─┼───► (envelope SSOT 완료)─┤                  └► H-2 focus-visible   PR-10
                 PR-6 ─┘                           └► ...
                 H-1 (hotfix, 독립)
```

- **W1 Gate**: 3 PR main 머지 + contract test CI 녹색 + apperror 전환 확인
- **W2 Gate**: Go 커버리지 70%+ · Frontend 60%+ · mockgen CI diff 0
- **W3 Gate**: 세션 전환 E2E 테스트 통과 + focus-visible 0 회귀
- **W4 Gate**: WS Auth 재접속 E2E + payload drift 0

## Scope globs

```
apps/server/internal/ws/**              # PR-1, PR-9, PR-10
apps/server/internal/apperror/**        # PR-3
apps/server/internal/seo/**             # PR-3 (http.Error → apperror)
apps/server/internal/infra/storage/**   # PR-3, PR-5
apps/server/internal/auditlog/**        # PR-6
apps/server/internal/domain/**          # PR-3, PR-5, PR-6, PR-9
apps/server/internal/admin/**           # PR-6
apps/server/internal/review/**          # PR-6
apps/server/internal/db/migrations/**   # PR-6, PR-9
apps/server/cmd/wsgen/**                # PR-10
apps/web/src/mocks/handlers/**          # PR-1
apps/web/src/stores/**                  # PR-7, PR-8
apps/web/src/hooks/useGameSync.ts       # PR-7
packages/shared/src/ws/**               # PR-1, PR-10
packages/ws-client/src/client.ts        # PR-1, PR-9, PR-10
memory/**                               # PR-0
MEMORY.md                               # PR-0
CLAUDE.md                               # PR-0
.golangci.yml                           # PR-3
.github/workflows/ci.yml                # PR-1, PR-5
```

## 예상 기간

| Wave | 기간 | 비고 |
|------|------|------|
| W0 | 0.5d | MEMORY 파편 정리 |
| W1 | 4–5d | 3 병렬 + H-1 hotfix |
| W2 | 6–7d | PR-5 XL → 3분할 순차 |
| W3 | 2d | 2 병렬 + H-2 hotfix |
| W4 | 3–4d | WS Auth + Payload validation |
| **총** | **16–19d** | 영업일 기준 |

## 참조

- **Backlog 원본**: `docs/plans/2026-04-17-platform-deep-audit/refs/phase19-backlog.md`
- **우선순위 재편**: `docs/plans/2026-04-18-architecture-audit-delta/priority-update.md`
- **Audit synthesis**: `docs/plans/2026-04-18-architecture-audit-delta/synthesis.md`
- **Executive summary**: `docs/plans/2026-04-17-platform-deep-audit/refs/executive-summary.md`
- **Specialists**: `docs/plans/2026-04-17-platform-deep-audit/refs/specialists/01~09-*.md`
- **graphify insights**: `docs/plans/2026-04-18-architecture-audit-delta/refs/graphify-insights.md`
- **PR-2 분할 설계** (완료, 참조용): `.../refs/pr-2-split-design.md`, `.../refs/pr-2/pr-2a,b,c-*.md`
- **PR-4 분할 설계** (완료, 참조용): `.../refs/pr-4-split-design.md`, `.../refs/pr-4/pr-4a,b-*.md`
- **요약 맵**: `refs/backlog-source.md` (본 phase 이전·이후 PR 매핑)

## 실행 규칙 (복기)

- `.claude/active-plan.json` 커밋 금지 (CLAUDE.md 제외 대상)
- feature branch + PR 필수 (main 직접 push 금지)
- 각 Wave 머지 전 사용자 확인 1회
- 리뷰는 4-agent 병렬 (security/perf/arch/test-coverage) — **admin-merge 전에 수행** (feedback_4agent_review_before_admin_merge)
- 파일 크기: Go 500 / TS·TSX 400 / MD 200
- Feature flag default off — in-flight wiring 보호

## 다음 단계

1. `plan.md` 작성 (PR별 task 번역, 체크박스 source)
2. `checklist.md` 작성 (STATUS marker + Wave 체크박스)
3. `refs/backlog-source.md` 작성 (완료/잔여/이월 매핑)
4. `.claude/active-plan.json` 수동 생성 (커밋 X)
5. PR merge 후 `/plan-go` → W0 PR-0 착수
