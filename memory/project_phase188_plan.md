---
name: Phase 18.8 — E2E Skip Recovery 플랜
description: 5 PR / 3 Wave로 E2E 11 skip 복구 + real-backend CI 점진 승격. H7 MaxPlayers + MSW + multi-context party + stubbed 복제. 2026-04-16 계획 승인 대기.
type: project
originSessionId: 7224d753-392e-4ac3-8d06-97bbcf225fe8
---
**Phase 18.8 E2E Skip Recovery** — 2026-04-16 플랜 머지 (PR #66). 실행 시작 전.

## 목표
현재 E2E `4 pass / 11 skip / 0 fail` → `13+ pass / ≤3 skip / 0 fail`. H7(MaxPlayers 계약 drift) + `PLAYWRIGHT_BACKEND` env gate + single-context 한계를 전부 해소하여 `game_runtime_v2` 런타임 전반에 회귀 방지망 확장.

## Wave 구조 (5 PR / 3 Wave)

| Wave | Mode | PRs | 요약 |
|------|------|-----|------|
| W1 | parallel | PR-1, PR-2 | MaxPlayers optional + MSW/party helper 인프라 |
| W2 | parallel | PR-3, PR-4 | game-redaction / clue-relation stubbed 복제본 |
| W3 | sequential | PR-5 | real-backend main push post-merge gate |

- PR-1 `fix(rooms): MaxPlayers optional + theme fallback` — FE는 이미 theme_id만 전송. 서버 `CreateRoomRequest.MaxPlayers`를 `*int32 + omitempty`로, nil 시 theme.MaxPlayers fallback. 5 tasks
- PR-2 `test(e2e): MSW foundation + party helper` — MSW v2 도입(handlers/auth·theme·room·clue), `common.ts` login/createRoom/createPartyOfN/waitForGamePage, msw-route 어댑터, playwright fixtures. 7 tasks
- PR-3 `test(e2e): game-redaction stubbed 복제본` — MSW HTTP + Playwright `routeWebSocket`으로 role별 redaction 4 시나리오. 4 tasks
- PR-4 `test(e2e): clue-relation stubbed 복제본` — MSW clue-relations fixture로 React Flow 그래프 3 시나리오. 4 tasks
- PR-5 `ci(e2e): real-backend main push + workflow_dispatch` — `phase-18.1-real-backend.yml`에 `push: [main]` 추가(post-merge 관측, required 아님) + 실패 알림 staging 채널 + `e2e-stubbed.yml`에 `workflow_dispatch`. 4 tasks

## 7대 결정
1. **Scope**: C 최대 (H7 + live 3종 stub + multi-context + CI 승격)
2. **H7**: 서버 optional + theme fallback (FE 변경 불필요)
3. **Multi-user**: P1 단일 테스트 N-context (`createPartyOfN(browser, 4)`)
4. **Stub 기술**: 혼합 — HTTP MSW (SSOT), WS page.route
5. **Persistence**: 기존 `e2e-themes.sql` (min=4, max=8, PUBLISHED) 재사용
6. **CI gate**: 점진적 승격 (관측 → 3일 green → Phase 18.9에서 required)
7. **도입**: 3 Wave / 5 PR / worktree 병렬

## 문서 위치
`docs/plans/2026-04-16-e2e-skip-recovery/`
- design.md / plan.md / checklist.md (STATUS marker 포함)
- refs/scope-and-decisions.md, architecture.md, execution-model.md, observability-testing.md
- refs/pr-{1..5}-*.md

13개 파일 모두 200줄 이하 (최대 134줄).

## 활성화 상태
- `.claude/active-plan.json` Phase 18.8로 세팅 완료
- 다음 단계: `/plan-go` → Wave 1 병렬 실행

## 알려진 위험 + 완화
- MSW ↔ 기존 page.route() 충돌 → 어댑터 `msw-route.ts`로 경계 명확화
- 4-context WS race → `waitForGamePage` Promise.all + 30s timeout + retry 3
- real-backend alerting spam → 최초 3일 staging 채널

## 후속 Phase 예약
- **Phase 18.9**: real-backend `required` 승격 (branch protection 변경)
- **Phase 19.0**: Voting/엔딩 커버리지 + MSW-Storybook 공유 (SSOT 확장)
