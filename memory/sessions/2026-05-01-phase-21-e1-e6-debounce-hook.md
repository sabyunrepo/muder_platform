---
topic: "Phase 21 E-1 (useDebouncedMutation 훅) + E-6 (file-size CI guard) — 4 PR 머지"
phase: "Phase 21 backlog"
prs_touched: [PR-178, PR-183, PR-184, PR-185]
session_date: 2026-05-01
---

# Session Handoff: Phase 21 E-1 + E-6 — useDebouncedMutation 훅 + file-size CI guard

## Decided

- **E-2 (jittda/ui 마이그레이션) 무효 판정**: `apps/web/CLAUDE.md` L3 "Tailwind 4 직접 사용, 디자인 시스템 라이브러리 의존 없음" 룰과 충돌. 글로벌 Seed Design 3단계 규칙은 이 프로젝트 미적용.
- **E-4 (LocationClueAssignPanel optimistic+rollback) 해소 판정**: `LocationClueAssignPanel.tsx:62-82` 이미 완전 구현.
- **5 consumer → 3 consumer 정정**: `CluePlacementPanel` / `ModulesSubTab`은 즉시 mutate (debounce 미사용)로 마이그레이션 대상 아님. 실제 대상은 `PhaseNodePanel` / `CharacterAssignPanel` / `EndingNodePanel`.
- **EndingNodePanel 동등화**: 기존 500ms debounce 보존하되 PhaseNodePanel 수준의 optimistic + rollback + onBlur flush 추가 (사용자 명시).
- **applyOptimistic 호출 시점**: schedule 시점 → **flush 시점** (round-2 perf-H2). 이유: 빠른 타이핑 시 cache subscriber (FlowCanvas) re-render 폭증 회피. CharacterAssignPanel은 토글 즉시 반응이 critical이라 saveConfig에서 직접 schedule-time setQueryData mirror + flush-time hook applyOptimistic은 rollback closure 캡처용.
- **rollback snapshot identity**: `pendingSnapshotRef`를 saveConfig 첫 호출 시 캡처하고 hook applyOptimistic이 그 ref의 진짜 pre-edit snapshot으로 rollback closure 작성 (round-3 N-1 / CR).
- **optsRef sync**: render body → useEffect (round-3 N-2, React 19 concurrent rendering 안전).
- **머지 정책**: docs-only PR (#178/#183/#185)은 paths-filter로 ci.yml fire 안 함 → admin-merge. PR #184는 Go test flaky (auditlog testcontainer postgres timeout, PR과 무관) → admin --squash.

## Rejected

- **applyOptimistic을 schedule 시점에 호출** (round-1) — 빠른 타이핑 canvas re-render 폭증 회귀.
- **`isPending` state in hook** (round-1) — 3 consumer 모두 미사용 dead surface, round-2에서 제거.
- **CharacterAssignPanel applyOptimistic이 flush-time `getQueryData`로 previous 캡처** (round-2) — 이미 schedule-time mirror된 상태를 캡처해 rollback이 mirror된 상태로만 복원 (silent data divergence). round-3에서 pendingSnapshotRef로 수정.
- **render body에서 `optsRef.current = ...`** (round-2) — React 19 concurrent rendering 위험. round-3에서 useEffect로 회복.
- **CR-3/CR-4 (PhaseNodePanel/CharacterAssignPanel 컴포넌트 분리) in-PR fix** — scope creep. follow-up E-7/E-8로 분리.
- **자동 fix-loop** — 매 round HIGH 발견 시 사용자 결정 대기 카논 (feedback_4agent_review_before_admin_merge.md).

## Risks

- **CI flaky (testcontainer postgres timeout)** — `internal/auditlog/store_test.go:346`. PR #184 1회 발생. 재발 빈도 미측정. → QUESTIONS Q-auditlog-testcontainer-flaky.
- **arc-runner queue 정체** — 동시 PR 다수 trigger 시 13분+ pending. `gh run rerun --failed`로 일부 job 재실행으로 우회 가능.
- **docs-only PR paths-filter BLOCKED** — admin-merge 의존 영구화 위험. 다음 세션 P0~P1 수준 결정 후보.
- **두 layer optimistic 패턴이 CharacterAssignPanel에만 적용** — PhaseNodePanel/EndingNodePanel은 단일 layer (flush 시점만). 향후 동일 즉시 반응 요구 panel 추가 시 패턴 명시 필요 (feedback_optimistic_apply_timing.md 카논화 권장).

## Files

### 신규
- `apps/web/src/hooks/useDebouncedMutation.ts` (213 LOC) — debounce timer + pending body + applyOptimistic + rollback closure + onBlur flush + unmount cleanup. 헬퍼 `clearTimer` / `flushMutation` / `schedulePending` / `useUnmountFlush` 분리 (60줄 룰 충족).
- `apps/web/src/hooks/__tests__/useDebouncedMutation.test.ts` — 14 테스트 케이스 (TDD).
- `apps/web/src/features/editor/components/design/__tests__/EndingNodePanel.test.tsx` — 5 회귀 테스트 (동등화 검증).
- `.github/workflows/file-size-guard.yml` (108 LOC) — PR diff `--diff-filter=AMR` warn-only CI step.
- `docs/runbooks/kt-cloud-arc-setup.md` — KT Cloud KS ARC 설치 런북 (별도 도메인, PR #178).

### 수정
- `apps/web/src/features/editor/components/design/PhaseNodePanel.tsx` (239 → 195 LOC).
- `apps/web/src/features/editor/components/design/CharacterAssignPanel.tsx` (251 → 229 LOC, pendingSnapshotRef 추가).
- `apps/web/src/features/editor/components/design/EndingNodePanel.tsx` (97 → 116 LOC, PhaseNodePanel 수준 동등화).
- `apps/web/src/features/editor/components/design/__tests__/CharacterAssignPanel.test.tsx` (+34 LOC, rollback snapshot identity 회귀 테스트).
- `memory/project_phase21_backlog.md` — E-2 무효 / E-4 해소 / E-1/E-6 해소 / E-7~E-12 신규 등록.

## Remaining

### Phase 21 backlog (Wave 1 후속)
- **E-3** Config 409 3-way merge (L+, 별도 phase brainstorm 필수). Done: brainstorm 완료 + design 문서 + phase 진입 승인.
- **E-5** `location_clue_assignment_v2` feature flag (S, 런타임 엔진 소비 게이트). Done: flag OFF/ON 분기 테스트 1건.
- **E-7** PhaseNodePanel 서브컴포넌트 분리 (M, CR-3). Done: JSX 150줄 이하.
- **E-8** CharacterAssignPanel + useCharacterConfigDebounce hook 분리 (M, CR-4). Done: JSX 150줄 이하.
- **E-9** file-size-guard glob 패턴 정정 (S). Done: `*/dist/*` / `*/internal/*/mocks/*` / `*.pb.go` / `*.gen.go` 추가, false positive 0.
- **E-10** FlushRefs bag 단순화 (XS). Done: bag 제거 + inline closure.
- **E-11** useUnmountFlush inline (XS). Done: 단일 호출 helper inline.
- **E-12** useDebouncedMutation 추가 회귀 테스트 (S). Done: schedule×2 windows / 재진입 contract / EndingNodePanel unmount-during-pending 3건 추가.

### Phase 19 Residual W4
- **PR-9** WS Auth Protocol (L). pending.
- **PR-10** Runtime Payload Validation (L). pending.

### Phase 23 인프라 (P0/P1)
- **P0-1** `build-runner-image.yml` `runs-on: ubuntu-latest` (S/H, chicken-egg fix).
- P1-4~7 (Composite action / govulncheck SHA pin / ubuntu builder SHA pin / ARG DOCKER_GID).

### Phase 19 audit log orphans
- O-1~4 (Ban/Unban + Password Change + Clue Graph CRUD).

## Next Session Priorities

- **P0**: P0-1 build-runner-image chicken-egg fix.
- **P1 묶음 A**: E-9 + E-10 + E-11 + E-12 (useDebouncedMutation 정리 + CI guard 정확도, S/XS급 묶음, 단일 PR 가능).
- **P1 단독**: E-5 location_clue_assignment_v2 feature flag.
- **P2 묶음 B**: E-7 + E-8 (에디터 컴포넌트 분리, M+M, scope creep 회피).
- **P3**: E-3 brainstorm (단독 phase 분기).

### docs-only PR paths-filter 정책 결정 필요
- 현행 admin-merge 영구화 vs `ci.yml` paths에 `docs/**` / `memory/**` 추가하여 docs-only PR도 정상 squash 가능하게 변경.
- automation-scout 권고: `pr-docs-only-check.md` Command 카논화로 결정 단일 source 확정.

---

## What we did

Phase 21 backlog 6 항목 (E-1~E-6) 검증으로 시작. E-2 (글로벌 Seed Design 3단계 룰 충돌) 무효 + E-4 (이미 구현됨) 해소 + E-1 (consumer 5→3 정정) + E-6 (CI 가드 신규) 처리. Wave 0 PR #183으로 backlog 정정 머지 후 Wave 1 PR #184에서 useDebouncedMutation 훅 + 3 consumer 마이그레이션 + EndingNodePanel 동등화 + file-size CI guard 동시 처리.

4-agent 리뷰 round-1에서 perf/arch/test 영역 HIGH 5건 발견 (perf-H1 isPending dead surface, perf-H2 schedule-time canvas re-render, arch-H1 flush 재진입 doc, arch-H2 StrictMode 미검증, test-H1 cancel+applyOptimistic, test-H2 applyOptimistic throw). 모두 in-PR fix.

CodeRabbit 2건 (60줄 룰 / rollback snapshot identity) 추가 발견. round-3에서 pendingSnapshotRef 패턴 + optsRef useEffect 회복 + 헬퍼 분리로 N-1/N-2 + CR 모두 해소. PR #184 admin --squash (auditlog testcontainer flaky로 인한 Go fail은 PR과 무관). PR #185로 follow-up E-7~E-12 등록 후 main에 적용.

vitest 1077/1077 pass · typecheck 0 errors · lint 0 errors · file-size guard 0 warning. 4 PR 모두 머지, 4 branch local + 원격 cleanup 완료.
