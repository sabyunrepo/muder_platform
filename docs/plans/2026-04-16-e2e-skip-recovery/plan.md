# Phase 18.8 — E2E Skip Recovery 실행 계획 (index)

> 부모: [design.md](design.md)
> MD 200줄 제한: 각 PR 상세는 `refs/pr-N-*.md`

---

## Overview

E2E 11 skip 복구 + real-backend CI 점진 승격. H7 루트 제거, MSW+party helper 인프라 구축, redaction/clue-relation stubbed 복제본, main push post-merge 관측 gate.

---

## Wave 구조

```
Wave 1 (parallel): PR-1, PR-2
  ↓
Wave 2 (parallel): PR-3, PR-4
  ↓
Wave 3 (sequential): PR-5
```

| Wave | Mode | PRs | 의존 | 예상 단위 |
|------|------|-----|------|----------|
| W1 | parallel | PR-1, PR-2 | - | 2T |
| W2 | parallel | PR-3, PR-4 | W1 | 2T |
| W3 | sequential | PR-5 | W2 | 1T |

---

## PR 목록

| PR | Wave | Title | 의존 | Scope | Tasks | 상세 |
|----|------|-------|------|-------|-------|------|
| PR-1 | W1 | fix(rooms): MaxPlayers optional + theme fallback | - | `apps/server/internal/domain/room/**` | 5 | [refs/pr-1-maxplayers-optional.md](refs/pr-1-maxplayers-optional.md) |
| PR-2 | W1 | test(e2e): MSW foundation + party helper | - | `apps/web/src/mocks/**`, `apps/web/e2e/helpers/**` | 7 | [refs/pr-2-msw-party-helper.md](refs/pr-2-msw-party-helper.md) |
| PR-3 | W2 | test(e2e): game-redaction stubbed 복제본 | PR-1, PR-2 | `apps/web/e2e/game-redaction-stubbed.spec.ts`, `apps/web/src/mocks/handlers/**` | 4 | [refs/pr-3-redaction-stubbed.md](refs/pr-3-redaction-stubbed.md) |
| PR-4 | W2 | test(e2e): clue-relation stubbed 복제본 | PR-1, PR-2 | `apps/web/e2e/clue-relation-stubbed.spec.ts`, `apps/web/src/mocks/handlers/clue.ts` | 4 | [refs/pr-4-clue-relation-stubbed.md](refs/pr-4-clue-relation-stubbed.md) |
| PR-5 | W3 | ci(e2e): real-backend main push + workflow_dispatch | PR-3, PR-4 | `.github/workflows/phase-18.1-real-backend.yml`, `.github/workflows/e2e-stubbed.yml` | 4 | [refs/pr-5-ci-promotion.md](refs/pr-5-ci-promotion.md) |

---

## Merge 전략

- Wave 내 병렬 PR은 `isolation: worktree`
- 머지는 항상 **PR 번호 순** sequential
- 각 머지 후 `go test -race -count=1 ./apps/server/...` + `pnpm --filter @mmp/web test` gate
- Wave 종료 시 user 확인 1회
- 충돌 발생 시 executor 서브에이전트에 해결 위임
- 4-parallel review (security / code-reviewer / test-engineer / docs-navigator) per PR
- Fix-loop 최대 3회 → 초과 시 user 개입

---

## Feature flag

환경변수: `PLAYWRIGHT_STUBBED_EXPANSION` (default: `false`)

- PR-1 ~ PR-2: 기존 테스트 영향 없음 — flag 불필요
- PR-3 ~ PR-4: stubbed spec은 기본 비활성, CI에서만 flag=true
- PR-5: main push post-merge 관측 — required 아님

prod/stage 환경 영향 없음 (테스트 인프라 전용).

---

## 알려진 위험

| 위험 | 완화 |
|------|------|
| MSW 셋업과 기존 page.route() 패턴 충돌 | PR-2에서 어댑터(`msw-route.ts`) 경계 명확화, 기존 editor-golden-path-fixtures는 유지 |
| 4-context party flaky (WS handshake race) | `waitForGamePage` 전원 동기 대기 + 3 retry + timeout 30s |
| real-backend alerting spam | 최초 3일은 알림 채널 staging에만, 안정화 후 main 채널로 |
| 서버 optional 전환으로 기존 클라이언트 regression | 기존 handler 테스트 유지 + new 테스트만 추가 (subtractive 변경 없음) |

---

## 후속 phase

- **Phase 18.9**: real-backend workflow `required` 승격 (branch protection 설정 변경)
- **Phase 19.0**: Voting/엔딩 페이즈 커버리지 + MSW-Storybook 공유 (SSOT 확장)
