---
name: Phase 18.6 E2E Recovery 진행중
description: login timeout + theme seed — Phase 18.4/PR#48 후속, CI green 확보
type: project
originSessionId: eec4a7b6-fc14-40e7-b876-9bb1b4210c13
---
# Phase 18.6 — E2E Recovery (진행중)

## 요약
- **시작**: 2026-04-16
- **배경**: PR #45 (Phase 18.4) + PR #48 (CI seed/migrate/build) 머지 후 남은 E2E 실패 해소
- **브랜치**: `phase/18.6-e2e-recovery` (origin push됨, 커밋 `039a1c2`)
- **관련 이슈**: #46 (resolve 예정)

## 구조 (3 Wave / 4 PR)
- **W0 PR-1** (sequential): Playwright trace 조사 — login `locator.fill` 30s timeout 원인 확정
- **W1 PR-2** (parallel): `apps/web/e2e/helpers/auth.ts` 공용 login helper + fix
- **W1 PR-3** (parallel): `apps/server/db/seed/e2e-themes.sql` + workflow seed step
- **W2 PR-4** (sequential): 3 E2E job green + memory 업데이트 + plan-finish

## 설계 문서 경로
- `docs/plans/2026-04-16-e2e-recovery/design.md` (index, 5대 결정)
- `docs/plans/2026-04-16-e2e-recovery/plan.md` (wave/PR matrix)
- `docs/plans/2026-04-16-e2e-recovery/checklist.md` (PR별 task 체크박스)
- `docs/plans/2026-04-16-e2e-recovery/refs/findings.md` (가설 4건 + probe 계획)

## 이어가기 (재개)
1. `git checkout phase/18.6-e2e-recovery` → `git pull`
2. `.claude/active-plan.json` 로드 → W0 PR-1 확인
3. `/plan-go` 로 PR-1 (trace 조사) 착수

## 현재 알려진 사실
- seed user (e2e@test.com) → 201 OK (PR #48)
- migrations 22개 전부 OK (PR #48 goose step)
- workspace `@mmp/game-logic` build OK (PR #48)
- 실제 실패: `locator.fill("이메일")` 30s timeout in beforeEach login

## 가설 (PR-1 probe 대상)
- H1: `@jittda/ui` TextField placeholder 렌더 wrapping
- H2: `useAuthStore` rehydrate 레이스
- H3: React 19 hydration 지연
- H4: `/api/v1/auth/login` 거부
