# Phase 19 Residual — 실행 Plan (Overview)

> **상세 task**: `checklist.md` (체크박스 source)
> **출처**: `docs/plans/2026-04-17-platform-deep-audit/refs/phase19-backlog.md` + `docs/plans/2026-04-18-architecture-audit-delta/priority-update.md`
> **날짜**: 2026-04-21

## Branch naming

`feat|fix|refactor|chore/phase-19-residual/PR-<N>-<slug>`
Hotfix는 `fix/phase-19-residual/h-<N>-<slug>`.

## PR 요약 (9 PR + 2 hotfix)

| # | Wave | Branch prefix | Title | Scope (핵심) | Size | Risk | Depends |
|---|------|---------------|-------|--------------|------|------|---------|
| PR-0 | W0 | `chore/pr-0-memory-canonical` | MEMORY Canonical Migration | `memory/`, `MEMORY.md`, `CLAUDE.md` | S | Low | — |
| PR-3 | W1 | `fix/pr-3-http-error-apperror` | HTTP Error Standardization | `seo/`, `infra/storage/local/`, `ws/upgrade*`, `apperror/`, `.golangci.yml` | M | Low | PR-0 |
| PR-1 | W1 | `feat/pr-1-ws-contract-ssot` | WS Contract SSOT (tygo codegen) | `ws/envelope_catalog.go`, `mocks/handlers/`, `shared/ws/`, `ws-client/` | L+ | Med | PR-0 |
| PR-6 | W1 | `feat/pr-6-auditlog-expansion` | Auditlog Expansion (+ editor 흡수) | `auditlog/`, `domain/{auth,editor}/`, `admin/`, `review/`, `db/migrations/` | L+ | Med | PR-0 |
| H-1 | W1 | `fix/h-1-voice-token-log` | voice token 평문 로그 제거 | `voice/provider.go:108` | XS | Low | — |
| PR-5 | W2 | `feat/pr-5{a,b,c}-coverage` | Coverage Gate + mockgen (3분할) | `.github/workflows/ci.yml`, Service interfaces, infra tests | XL | High | PR-3 |
| PR-7 | W2 | `refactor/pr-7-zustand-apply-ws-event` | Zustand Action Unification | `stores/{gameSession,gameMessage,moduleFactory}`, `hooks/useGameSync.ts` | M | Med | PR-1 |
| PR-8 | W3 | `fix/pr-8-module-cache-session-key` | Module Cache Isolation | `stores/moduleStoreFactory.ts`, `gameSessionStore.ts` | S | Low | PR-7 |
| H-2 | W3 | `fix/h-2-focus-visible` | focus-visible 57건 | `apps/web/src/**/*.tsx` | S | Low | — |
| PR-9 | W4 | `feat/pr-9-ws-auth-protocol` | WS Auth Protocol (IDENTIFY/RESUME) | `ws/auth_protocol.go`, `domain/auth/`, `db/migrations/`, `ws-client/` | L | Med | PR-1 |
| PR-10 | W4 | `feat/pr-10-runtime-payload-zod` | Runtime Payload Validation | `cmd/wsgen`, `shared/ws/schemas.generated.ts`, `ws/validator.go` | L | Med | PR-1 |

## 의존 그래프

```
W0: PR-0
     │
     ├──► W1: PR-3 ──┐
     │              │
     ├──► W1: PR-1 ──┼──► W2: PR-5 (a→b→c 순차) ──► ...
     │              │          │
     ├──► W1: PR-6 ─┘          └──► W2: PR-7 ──► W3: PR-8
     │
     │     (독립 hotfix)
     └──► H-1 voice token

W3 hotfix: H-2 focus-visible (독립)

W4 (PR-1 기반):
     ├──► PR-9  WS Auth Protocol
     └──► PR-10 Runtime Payload Validation
```

## Wave Gate

| Wave | Gate 기준 |
|------|----------|
| W0 | `memory/` 재정비 + QMD reindex 완료 + MEMORY.md 갱신 |
| W1 | 3 PR main 머지 + contract test CI green + `http.Error` 잔존 0 + auth/admin/review auditlog 100% |
| W2 | Go coverage ≥60% hard fail + frontend ≥50% + mockgen CI diff 0 + `.getState()` 잔존 0 |
| W3 | session 전환 E2E green + axe-core focus-visible pass |
| W4 | revoke → WS 종료 E2E + payload drift 0 |

## 머지 순서

1. **W0** — PR-0 단일
2. **W1** — PR-3, PR-1, PR-6 3 병렬 + H-1 hotfix (언제든)
3. **W2** — PR-5a → PR-5b → PR-5c 순차 → PR-7
4. **W3** — PR-8 + H-2 병렬
5. **W4** — PR-9, PR-10 병렬

각 Wave 머지 전 사용자 확인 1회 필수.

## 리뷰 규약 (feedback_4agent_review_before_admin_merge)

모든 PR에 대해 admin-merge 전 4-agent 병렬 리뷰:
- **security-reviewer** (opus) — AppError/RFC9457/auditlog/token
- **oh-my-claudecode:code-reviewer** (sonnet) — SOLID/logic defects
- **test-engineer** (sonnet) — 커버리지·mockgen·flaky
- **module-architect** (sonnet, 모듈 변경 PR만) — BaseModule/PlayerAware/Factory

HIGH 이슈 발견 시 hotfix PR 1회 허용 (Phase 19 PR-2c → #108 hotfix 사례).

## Feature flag

모든 신규 기능 env default off, staging 관측 → on 승격:
- `MMP_WS_PAYLOAD_VALIDATION` (PR-10)
- `MMP_WS_AUTH_PROTOCOL` (PR-9)
- `MMP_COVERAGE_HARD_FAIL` (PR-5b; 초기 false → gate 안정 후 true)

## 파일 크기 규칙 재확인

- `.go` 500줄 / 함수 80줄
- `.ts` / `.tsx` 400줄 / 일반 60 / 컴포넌트 150
- `.md` 200줄 (이 plan.md는 ≤150 목표)

## 관측 / 롤백

- 각 PR 머지 후 staging 3일 관측 (대형 PR-1/5/6/9/10은 필수)
- 회귀 감지 시 feature flag off → hotfix PR → 4-agent 재검토
- coverage hard gate 초기 60% → 회귀 시 threshold 하향 + 원인 분석 PR

## 미반영 (Phase 21 이월)

- graphify-driven: Mutex Hotspot Audit / CLAUDE.md ↔ code Linter / Admin Dead-code / Audio-Video Orchestrator
- P2 백로그 28건

## 다음 액션

1. `checklist.md` 작성 (PR별 체크박스 source)
2. `refs/backlog-source.md` 작성
3. `.claude/active-plan.json` 수동 생성 (커밋 X)
4. PR 생성 + 사용자 승인 + merge
5. `/plan-go` → W0 PR-0 착수
