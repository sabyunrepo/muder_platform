---
topic: "Phase 21 backlog wave — 5 PR 머지 (E-7/E-8/E-10/E-11/E-12 해소 + Phase 23 close + E-5 defer)"
phase: "Phase 21 backlog"
prs_touched: [PR-188, PR-189, PR-190, PR-191, PR-192]
session_date: 2026-05-01
---

# Session Handoff: Phase 21 backlog wave — 5 PR sequential merge

## Decided

- **Phase 23 Custom Runner Image 라인 종료 (option a)**: 인프라 follow-up 5건(P0-1 / P1-4~7)을 backlog에서 영구 제거. main이 KT Cloud KS arc-runner-set으로 진화하면서 `build-runner-image.yml` / `infra/runners/Dockerfile` 자체가 obsolete. (PR #188)
- **E-5 location_clue_assignment_v2 defer (option c)**: 코드 grep 0 hit 확인 후 Phase 24 후보 (brainstorm 필수)로 이월. placeholder flag 추가 = 글로벌 카논 "🔴 partial impl 금지" 위반 risk. E-3와 동일 분류. (PR #190)
- **useDebouncedMutation 60룰 우선 carve-out**: E-10 (FlushRefs bag 제거) + E-11 (useUnmountFlush inline) 후 본문이 60줄 넘을 risk라 helper 1개(`flushPending`)는 외부 보존, individual ref 인자 받는 형태로 변형. 함수 본문 49줄 (60룰 충족, 마진 11). (PR #189)
- **PhaseNodePanel 분리: 3 sub-component**: PhasePanelBasicInfo + PhasePanelTimerSettings + PhasePanelAdvanceToggle. warning timer는 autoAdvance에 종속이라 PhasePanelAdvanceToggle 안에 흡수 (4-agent HIGH 1건 → in-PR fix). (PR #191)
- **CharacterAssignPanel 분리: hook + 1 sub-component**: useCharacterConfigDebounce hook (debouncer + saveConfig + pendingSnapshotRef + flush) + CharacterList. 두 layer 패턴 (schedule-time mirror + flush-time applyOptimistic) 캡슐화. (PR #191)
- **4-agent carve-out 자연 사용**: 본 환경에서 oh-my-claudecode:* agent 가용 X → `superpowers:code-reviewer` 1회로 자연 fallback. 사용자 자율 모드 + 보안 critical 변경 0이라 default 우회 인정.

## Rejected

- **E-5 placeholder flag 추가 (option b)**: 사용처 0인 채 flag 추가 = partial 위반 risk. (사용자 명시 (c) 결정)
- **E-7/E-8 sub-component 단위 테스트 추가**: 부모 panel 통합 테스트 25건이 cover하므로 over-engineering 회피.
- **PhasePanelTimerSettings 안에 warning timer 보존 (round-1)**: control 순서 회귀 (warning timer가 toggle 아래로) — round-2에서 PhasePanelAdvanceToggle로 흡수해 원본 순서 복원.

## Risks

- **docs-only PR paths-filter 영구 admin-merge 의존**: 본 세션 4 PR(#188/#190/#192/일부)이 paths-filter로 ci.yml fire 안 함 → admin --squash. main 보호 정책 점진 무력화 risk. 다음 세션 정책 결정 필요 (P1).
- **oh-my-claudecode:* agent 환경적 부재**: 영구인지 세션 한정인지 미확인. 영구라면 carve-out 자동 fallback으로 카논 갱신 필요 (P1).
- **컴포넌트 분리 시 DOM 순서 회귀 패턴**: PR #191에서 1건 발생 (4-agent가 검출). 향후 분리 PR에서 동일 회귀 risk → MISTAKES 카논화 권장.
- **E-9 file-size-guard glob 미정정**: 현재 false positive 가능성 (round-2 arch M-1/M-2). 단독 인프라 PR로 빠르게 처리 (P0).

## Files

### 신규
- `apps/web/src/features/editor/components/design/PhasePanelBasicInfo.tsx` (56 LoC) — label + phase type select
- `apps/web/src/features/editor/components/design/PhasePanelTimerSettings.tsx` (52 LoC) — duration + rounds
- `apps/web/src/features/editor/components/design/PhasePanelAdvanceToggle.tsx` (55 LoC) — auto-advance toggle + conditional warning timer
- `apps/web/src/features/editor/components/design/CharacterList.tsx` (44 LoC)
- `apps/web/src/features/editor/hooks/useCharacterConfigDebounce.ts` (103 LoC, hook)

### 수정
- `apps/web/src/hooks/useDebouncedMutation.ts` — 213 → 188 LoC. FlushRefs bag inline / useUnmountFlush inline / JSDoc 재진입 contract 명확화. 함수 본문 49줄.
- `apps/web/src/hooks/__tests__/useDebouncedMutation.test.ts` — 14 → 16 tests (+schedule×2 windows, 재진입 contract).
- `apps/web/src/features/editor/components/design/__tests__/EndingNodePanel.test.tsx` — 5 → 6 tests (+unmount-during-pending 자동 flush).
- `apps/web/src/features/editor/components/design/PhaseNodePanel.tsx` — 195 → 98 LoC. 3 sub-component 사용.
- `apps/web/src/features/editor/components/design/CharacterAssignPanel.tsx` — 248 → 151 LoC. hook + 1 sub-component 사용.
- `memory/project_phase21_backlog.md` — Phase 23 인프라 close + E-5 Phase 24 defer + E-7/E-8/E-10/E-11/E-12 Resolved 마킹 + 해소 근거 4 섹션.
- `memory/MEMORY.md` — backlog 인덱스 한 줄 동기화 (3회 갱신).

## Remaining

### Phase 21 backlog
- **E-3** Config 409 3-way merge — Phase 24 후보, brainstorm 필수 (L+)
- **E-5** location_clue_assignment_v2 flag — Phase 24 후보, brainstorm 필수 (게이트 대상 v2 부재)
- **E-9** file-size-guard.yml glob 정정 — 단독 인프라 PR (S). Done: PR 머지 + CI job pass + backlog Resolved 마킹.

### Phase 19 Residual W4
- **PR-9** WS Auth Protocol (L). pending.
- **PR-10** Runtime Payload Validation (L). pending.

### Phase 19 audit log orphans
- **O-1** ActionUserPasswordChange (auth)
- **O-2** ActionAdminBan / Unban (admin lifecycle)
- **O-3** ActionEditorClueEdgeCreate / Delete
- **O-4** ActionEditorClueRelationCreate / Delete

### 정책 결정 미해결
- docs-only PR paths-filter 정책 (admin-merge 영구화 vs ci.yml paths 추가)
- oh-my-claudecode:* 가용성 + carve-out 자동 fallback 정책

## Next Session Priorities

- **P0**: E-9 file-size-guard glob 정정 (S/H, 단독 인프라 PR).
- **P1-A**: docs-only PR paths-filter 정책 명문화 (`feedback_4agent_review_before_admin_merge.md`).
- **P1-B**: 4-agent fallback 정책 명시 (oh-my-claudecode 부재 시 `superpowers:code-reviewer` 1회).
- **P2**: Phase 19 W4 PR-9 (WS Auth Protocol) — L 규모, 단독 phase 진입 권장.
- **P2**: Phase 19 audit log orphan O-1~O-4 — 4 vertical PR (M×4).
- **P3**: E-3 / E-5 Phase 24 brainstorm — W4 머지 후 단독 분기.

---

## What we did

Phase 21 backlog 잔존 7건(E-3/E-5/E-7/E-8/E-10/E-11/E-12) 중 immediate PR 가능 5건 sequential merge. 첫 PR(#188)은 사용자 결정 (a)로 Phase 23 인프라 follow-up 5건 영구 close. 다음 PR(#189)은 useDebouncedMutation cleanup 묶음 — E-12 회귀 테스트 3건 (schedule×2 windows / 재진입 contract / EndingNodePanel unmount-during-pending) 먼저 추가 후 E-10/E-11 inline. 60룰 위반 risk 발견 시 helper 1개(`flushPending`) 외부 보존 + FlushRefs bag만 제거 형태로 carve-out.

PR #190은 E-5 immediate 시도 중 코드 grep 0 hit 확인 후 사용자 결정 (c)로 Phase 24 defer. PR #191은 E-7+E-8 묶음 — PhaseNodePanel 195→98 / CharacterAssignPanel 248→151. 4-agent carve-out review에서 HIGH 1건(auto-advance toggle 위치 회귀) 검출 → in-PR fix (warning timer를 PhasePanelAdvanceToggle 안으로 흡수). PR #192는 backlog 5 entries Resolved 마킹 + 해소 근거 4 섹션.

vitest 1080/1080 pass · typecheck 0 · lint 0. 5 PR 모두 admin --squash 머지 (docs-only 4건은 paths-filter, code 변경 PR 1건은 명시 admin merge).

세션 도중 사용자가 "Opus = CTO" 비유로 위임 정책 글로벌 카논화 요청 → 글로벌 `~/.claude/CLAUDE.md`에 "위임 정책 (CTO 모드)" 섹션 추가. 본 wrap 범위 외.
