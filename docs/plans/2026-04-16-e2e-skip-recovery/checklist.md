<!-- STATUS-START -->
**Active**: Phase 18.8 E2E Skip Recovery — Wave 1/3
**PR**: PR-1 (0%)
**Task**: 계획 승인 대기
**State**: pending
**Blockers**: (none)
**Last updated**: 2026-04-16
<!-- STATUS-END -->

# Phase 18.8 — E2E Skip Recovery 체크리스트

> 부모: [design.md](design.md) | 실행: [plan.md](plan.md)
> STATUS 마커는 hook/스크립트가 파싱하므로 수정 시 형식 유지.

---

## Wave 1 — Foundation (parallel)

### PR-1: fix(rooms): MaxPlayers optional + theme fallback
- [ ] Task 1 — `CreateRoomRequest.MaxPlayers`를 `*int32` + `validate:"omitempty,min=2,max=12"`로 변경
- [ ] Task 2 — `service.go:CreateRoom`에서 nil 시 theme 조회 → `theme.MaxPlayers` fallback + 범위 재검증
- [ ] Task 3 — handler_test.go에 optional 시나리오 + theme fallback 케이스 추가
- [ ] Task 4 — service_test.go에 min/max 범위 검증 테이블 테스트 추가
- [ ] Task 5 — Run after_task pipeline (go fmt + scope test + go test -race)

### PR-2: test(e2e): MSW foundation + party helper
- [ ] Task 1 — MSW v2 설치 + `apps/web/src/mocks/{browser,server}.ts` 셋업
- [ ] Task 2 — handlers/{auth,theme,room,clue}.ts 초기 핸들러 작성
- [ ] Task 3 — `apps/web/e2e/helpers/msw-route.ts` MSW→page.route 어댑터
- [ ] Task 4 — `apps/web/e2e/helpers/common.ts` — login/createRoom/createPartyOfN/waitForGamePage
- [ ] Task 5 — playwright.config.ts fixtures 확장 (authenticatedPage, multiPartyContext)
- [ ] Task 6 — 기존 game-session.spec.ts 1건 helper로 리팩터 + pass 확인
- [ ] Task 7 — helper 단위 테스트(Vitest) + after_task pipeline

**Wave 1 gate**:
- [ ] PR-1 all tasks ✅
- [ ] PR-2 all tasks ✅
- [ ] Parallel 4-reviewer pass
- [ ] Fix-loop < 3 iterations
- [ ] `go test -race ./apps/server/...` + `pnpm --filter @mmp/web test` pass
- [ ] Both PRs merged to main
- [ ] User confirmed Wave 2 진입

---

## Wave 2 — Stub Expansion (parallel)

### PR-3: test(e2e): game-redaction stubbed 복제본
- [ ] Task 1 — `apps/web/src/mocks/handlers/game-ws.ts` — role별 payload 4종 (normal/murderer/detective/whisper)
- [ ] Task 2 — `apps/web/e2e/game-redaction-stubbed.spec.ts` 신규 (4 시나리오)
- [ ] Task 3 — 기존 game-redaction.spec.ts에 주석으로 stubbed 대응 관계 표기
- [ ] Task 4 — stubbed CI에서 4 시나리오 pass + after_task pipeline

### PR-4: test(e2e): clue-relation stubbed 복제본
- [ ] Task 1 — `apps/web/src/mocks/handlers/clue.ts` clue-relation API 핸들러 확장
- [ ] Task 2 — `apps/web/e2e/clue-relation-stubbed.spec.ts` 신규 (3 시나리오)
- [ ] Task 3 — React Flow 그래프 assertion 패턴 확인
- [ ] Task 4 — stubbed CI에서 3 시나리오 pass + after_task pipeline

**Wave 2 gate**:
- [ ] PR-3, PR-4 all tasks ✅
- [ ] Parallel 4-reviewer pass
- [ ] stubbed CI 전체 skip 수 ≤3
- [ ] Both merged
- [ ] User confirmed Wave 3 진입

---

## Wave 3 — CI Promotion (sequential)

### PR-5: ci(e2e): real-backend main push + workflow_dispatch
- [ ] Task 1 — `phase-18.1-real-backend.yml`에 `push: [main]` 추가 (required 아님)
- [ ] Task 2 — 실패 시 Slack/Discord 알림 step (staging 채널) 추가
- [ ] Task 3 — `e2e-stubbed.yml`에 `workflow_dispatch` 추가
- [ ] Task 4 — `refs/ci-promotion.md`에 3일 green 후 required 승격 후속 PR 예약 기록

**Wave 3 gate**:
- [ ] PR-5 merged
- [ ] main push 후 real-backend workflow 자동 실행 확인
- [ ] 의도적 실패 커밋으로 알림 도달 확인 후 revert
- [ ] 3일 연속 nightly green

---

## Phase completion gate

- [ ] All waves ✅
- [ ] E2E stubbed CI: `13+ pass / ≤3 skip / 0 fail`
- [ ] `memory/project_phase188_progress.md` 최종
- [ ] `MEMORY.md` 인덱스 업데이트 (Phase 18.8 완료 링크)
- [ ] Root checklist "Phase 18.8 ✅"
- [ ] `/plan-finish` executed
- [ ] Phase 18.9 (required 승격) 예약 메모 기록
