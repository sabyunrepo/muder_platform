<!-- STATUS-START -->
**Active**: Phase 17.0 에디터 v2 이식 — 전체 완료 ✅
**PR**: W1~W4 ✅ (PR-1~7 전체 완료)
**Task**: Phase completion
**State**: completed
**Blockers**: none
**Last updated**: 2026-04-14
<!-- STATUS-END -->

# Phase 17.0 에디터 UX v2 이식 + 흐름 에디터 완성 체크리스트

> 부모: [design.md](design.md) | 실행: [plan.md](plan.md)

---

## Wave 1 — 흐름 에디터 Wiring (parallel)

### PR-1: 엣지 삭제 + Delete 키
- [x] Task 1 — FlowCanvas에 deleteKeyCode + edgesFocusable 활성화
- [x] Task 2 — useFlowData에 엣지 삭제 감지 + autoSave 연동
- [x] Task 3 — Vitest 테스트 작성 (FlowCanvasEdgeDelete.test.tsx 3건)
- [x] Run after_task pipeline

### PR-2: 분기노드 + 커스텀엣지 등록
- [x] Task 1 — FlowCanvas nodeTypes에 branch 추가
- [x] Task 2 — FlowCanvas edgeTypes에 condition 등록
- [x] Task 3 — onEdgeConditionChange wiring (useFlowData → FlowCanvas → Panel)
- [x] Task 4 — Vitest 테스트 작성 (BranchWiring.test.tsx 5건)
- [x] Run after_task pipeline

**Wave 1 gate**:
- [x] All PR-1 tasks done
- [x] All PR-2 tasks done
- [x] `pnpm test` pass (328/328 editor tests)
- [x] Both PRs merged to main
- [ ] User confirmed next wave

---

## Wave 2 — 흐름 에디터 강화 (parallel)

### PR-3: PhaseNodePanel 강화
- [x] Task 1 — FlowNodeData 타입 확장 (autoAdvance, warningAt, onEnter, onExit)
- [x] Task 2 — PhaseNodePanel UI 추가 (자동진행, 경고타이머)
- [x] Task 3 — ActionListEditor 컴포넌트 (onEnter/onExit 액션, 7종)
- [x] Task 4 — Vitest 테스트 (PhaseNodePanelExtended.test.tsx 5건)
- [x] Run after_task pipeline

### PR-4: 흐름 프리셋 시스템
- [x] Task 1 — flowPresets.ts 정의 (클래식, 타임어택, 자유탐색)
- [x] Task 2 — FlowToolbar에 프리셋 드롭다운 + 확인 다이얼로그
- [x] Task 3 — Vitest 테스트 (flowPresets.test.ts 7건)
- [x] Run after_task pipeline

**Wave 2 gate**:
- [x] All PR-3 tasks done
- [x] All PR-4 tasks done
- [x] `pnpm test` pass (340/340 editor tests)
- [x] Both PRs merged to main
- [ ] User confirmed next wave

---

## Wave 3 — UX 이식 (parallel)

### PR-5: 검증→탭이동 + 스토리 split-view
- [x] Task 1 — ERROR_TAB_MAP + ValidationPanel (4 category→tab 매핑)
- [x] Task 2 — EditorLayout에 ValidationPanel 연동 + handleValidate
- [x] Task 3 — StoryTab split-view (이미 구현됨, 확인 완료)
- [x] Task 4 — Vitest 테스트 (ValidationPanel.test.tsx 4건)
- [x] Run after_task pipeline
- [x] 보너스 — TabContent 추출 (EditorLayout 200줄 제한 해결)

### PR-6: 흐름 시뮬레이션 패널
- [x] Task 1 — FlowSimulationPanel (토폴로지정렬, 진행바, 소요시간)
- [x] Task 2 — 다음/이전/처음 버튼 + nodeClassName 하이라이트
- [x] Task 3 — Vitest 테스트 (FlowSimulationPanel.test.tsx 5건)
- [x] Run after_task pipeline

**Wave 3 gate**:
- [x] All PR-5 tasks done
- [x] All PR-6 tasks done
- [x] `pnpm test` pass (349/349 editor tests)
- [x] Both PRs merged to main
- [ ] User confirmed next wave

---

## Wave 4 — 동적 탭 (sequential)

### PR-7: 동적 탭 (모듈 기반)
- [x] Task 1 — EDITOR_TABS에 always/requiredModule 조건 추가
- [x] Task 2 — EditorTabNav에서 활성 모듈 기반 필터링 + 자동 전환
- [x] Task 3 — Vitest 테스트 (EditorTabNav.test.tsx 4건)
- [x] Run after_task pipeline

**Wave 4 gate**:
- [x] All PR-7 tasks done
- [x] `pnpm test` pass (353/353 editor tests)
- [x] PR merged to main
- [x] User confirmed

---

## Phase completion gate

- [x] All waves done (W1~W4)
- [x] 엣지 삭제 동작 (Delete 키 + edgesFocusable)
- [x] 분기 조건 설정 → 서버 저장 (updateEdgeCondition + autoSave)
- [x] PhaseNodePanel 7+ 필드 편집 (autoAdvance, warningAt, onEnter, onExit)
- [x] 프리셋 1클릭 적용 (클래식/타임어택/자유탐색)
- [x] 시뮬레이션 페이즈 순회 (토폴로지정렬 + 하이라이트)
- [x] 검증 에러 → 탭 이동 (ERROR_TAB_MAP + ValidationPanel)
- [x] 동적 탭 동작 (always/requiredModule 필터링)
- [x] Vitest 테스트 유지 (353/353)
- [ ] `/plan-finish` 실행
