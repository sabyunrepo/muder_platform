<!-- STATUS-START -->
**Active**: Phase 18.8 E2E Skip Recovery — 5/5 PR merged · 관측 단계
**PR**: PR-5 (100%)
**Task**: 3일 nightly green 관측 + alert 도달 검증
**State**: observation
**Blockers**: (none — Phase 종료는 사용자 수동 secret 등록 + 관측 후)
**Last updated**: 2026-04-17
<!-- STATUS-END -->

# Phase 18.8 — E2E Skip Recovery 체크리스트

> 부모: [design.md](design.md) | 실행: [plan.md](plan.md)
> STATUS 마커는 hook/스크립트가 파싱하므로 수정 시 형식 유지.

---

## Wave 1 — Foundation (parallel)

### PR-1: fix(rooms): MaxPlayers optional + theme fallback ✅ merged `4dda7b9`
- [x] Task 1 — `CreateRoomRequest.MaxPlayers`를 `*int32` + `validate:"omitempty,min=2,max=12"`로 변경
- [x] Task 2 — `service.go:CreateRoom`에서 nil 시 theme 조회 → `theme.MaxPlayers` fallback + 범위 재검증
- [x] Task 3 — handler_test.go에 optional 시나리오 + theme fallback 케이스 추가
- [x] Task 4 — service_test.go에 min/max 범위 검증 테이블 테스트 추가
- [x] Task 5 — Run after_task pipeline (go fmt + scope test + go test -race)

### PR-2: test(e2e): MSW foundation + party helper ✅ merged `e915889` (fix-loop)
- [x] Task 1 — MSW v2 설치 + `apps/web/src/mocks/{browser,server}.ts` 셋업
- [x] Task 2 — handlers/{auth,theme,room,clue}.ts 초기 핸들러 작성
- [x] Task 3 — `apps/web/e2e/helpers/msw-route.ts` MSW→page.route 어댑터
- [x] Task 4 — `apps/web/e2e/helpers/common.ts` — login/createRoom/createPartyOfN/waitForGamePage
- [x] Task 5 — playwright.config.ts fixtures 확장 (`helpers/fixtures.ts`로 분리, opt-in)
- [x] Task 6 — 기존 game-session.spec.ts 1건 helper로 리팩터 + pass 확인
- [x] Task 7 — helper 단위 테스트(Vitest 13/13) + after_task pipeline

**Wave 1 gate** ✅
- [x] PR-1 all tasks ✅
- [x] PR-2 all tasks ✅
- [x] Parallel 4-reviewer pass (PR-2 fix-loop 1회 — HIGH/MED/blocker 5건 처리)
- [x] Fix-loop < 3 iterations
- [x] `go test -race ./apps/server/...` (25 case PASS) + `pnpm --filter @mmp/web test` (vitest 13/13) pass
- [x] Both PRs merged to main
- [x] User confirmed Wave 2 진입

---

## Wave 2 — Stub Expansion (parallel)

### PR-3: test(e2e): game-redaction stubbed 복제본 ✅ merged `eff731f` (fix-loop)
- [x] Task 1 — `apps/web/src/mocks/handlers/game-ws.ts` — role별 payload 4종 (normal/murderer/detective/whisper)
- [x] Task 2 — `apps/web/e2e/game-redaction-stubbed.spec.ts` 신규 (4 시나리오 + detective fix-loop 보강)
- [x] Task 3 — 기존 game-redaction.spec.ts 주석 (별도 commit `2400bb9`로 처리, scope 외)
- [x] Task 4 — typecheck PASS + after_task pipeline (실 stubbed CI는 PR-5 후 검증)

### PR-4: test(e2e): clue-relation stubbed 복제본 ✅ merged `75fdb9f`
- [x] Task 1 — `apps/web/src/mocks/handlers/clue.ts` clue-relation API 핸들러 확장 (서버 SSOT 일치 GET/PUT)
- [x] Task 2 — `apps/web/e2e/clue-relation-stubbed.spec.ts` 신규 (3 시나리오)
- [x] Task 3 — React Flow `toHaveCount`/`.selected` assertion 패턴 적용 + clue-relation-live 주석 (commit `2400bb9`)
- [x] Task 4 — vitest 16/16 PASS + typecheck PASS (실 stubbed CI는 PR-5 후 검증)

**Wave 2 gate** ✅
- [x] PR-3, PR-4 all tasks ✅
- [x] Parallel 4-reviewer pass (PR-3 fix-loop 1회 — seqCounter closure + detective 시나리오)
- [ ] stubbed CI 전체 skip 수 ≤3 (PR-5 머지 + 실 CI run으로 검증)
- [x] Both merged
- [x] User confirmed Wave 3 진입

---

## Wave 3 — CI Promotion (sequential)

### PR-5: ci(e2e): real-backend main push + workflow_dispatch ✅ merged `8006efb`
- [x] Task 1 — `phase-18.1-real-backend.yml`에 `push: [main]` 추가 (required 아님)
- [x] Task 2 — 실패 시 Slack/Discord 알림 step (staging 채널, secret 미등록 시 no-op)
- [x] Task 3 — `e2e-stubbed.yml`에 `workflow_dispatch` 추가
- [x] Task 4 — `refs/ci-promotion.md` 신규 (92줄, Phase 18.9 승격 작업 + 검증 체크리스트)

**Wave 3 gate** ✅ (코드 머지) / 관측 단계 진행 중
- [x] PR-5 merged
- [ ] main push 후 real-backend workflow 자동 실행 확인 (다음 push로 검증)
- [ ] 의도적 실패 커밋으로 알림 도달 확인 후 revert (사용자가 secret 등록 후 진행)
- [ ] 3일 연속 nightly green (관측 시작: `8006efb` 머지 후)

---

## Phase completion gate

- [ ] All waves ✅
- [ ] E2E stubbed CI: `13+ pass / ≤3 skip / 0 fail`
- [ ] `memory/project_phase188_progress.md` 최종
- [ ] `MEMORY.md` 인덱스 업데이트 (Phase 18.8 완료 링크)
- [ ] Root checklist "Phase 18.8 ✅"
- [ ] `/plan-finish` executed
- [ ] Phase 18.9 (required 승격) 예약 메모 기록
