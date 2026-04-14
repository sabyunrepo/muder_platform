<!-- STATUS-START -->
**Active**: Phase 17.0 에디터 v2 이식 — Wave 1/4
**PR**: PR-1 (0%)
**Task**: 시작 전
**State**: not_started
**Blockers**: none
**Last updated**: 2026-04-14
<!-- STATUS-END -->

# Phase 17.0 에디터 UX v2 이식 + 흐름 에디터 완성 체크리스트

> 부모: [design.md](design.md) | 실행: [plan.md](plan.md)

---

## Wave 1 — 흐름 에디터 Wiring (parallel)

### PR-1: 엣지 삭제 + Delete 키
- [ ] Task 1 — FlowCanvas에 deleteKeyCode + edgesFocusable 활성화
- [ ] Task 2 — useFlowData에 엣지 삭제 감지 + autoSave 연동
- [ ] Task 3 — Vitest 테스트 작성
- [ ] Run after_task pipeline

### PR-2: 분기노드 + 커스텀엣지 등록
- [ ] Task 1 — FlowCanvas nodeTypes에 branch 추가
- [ ] Task 2 — FlowCanvas edgeTypes에 condition 등록
- [ ] Task 3 — onEdgeConditionChange wiring (useFlowData → FlowCanvas → Panel)
- [ ] Task 4 — Vitest 테스트 작성
- [ ] Run after_task pipeline

**Wave 1 gate**:
- [ ] All PR-1 tasks done
- [ ] All PR-2 tasks done
- [ ] `pnpm test` pass
- [ ] Both PRs merged to main
- [ ] User confirmed next wave

---

## Wave 2 — 흐름 에디터 강화 (parallel)

### PR-3: PhaseNodePanel 강화
- [ ] Task 1 — FlowNodeData 타입 확장 (autoAdvance, warningAt, onEnter, onExit)
- [ ] Task 2 — PhaseNodePanel UI 추가 (자동진행, 경고타이머)
- [ ] Task 3 — ActionListEditor 컴포넌트 (onEnter/onExit 액션)
- [ ] Task 4 — Vitest 테스트
- [ ] Run after_task pipeline

### PR-4: 흐름 프리셋 시스템
- [ ] Task 1 — flowPresets.ts 정의 (클래식, 타임어택, 자유탐색)
- [ ] Task 2 — FlowToolbar에 프리셋 드롭다운 추가
- [ ] Task 3 — Vitest 테스트
- [ ] Run after_task pipeline

**Wave 2 gate**:
- [ ] All PR-3 tasks done
- [ ] All PR-4 tasks done
- [ ] `pnpm test` pass
- [ ] Both PRs merged to main
- [ ] User confirmed next wave

---

## Wave 3 — UX 이식 (parallel)

### PR-5: 검증→탭이동 + 스토리 split-view
- [ ] Task 1 — ERROR_TAB_MAP + onErrorClick 핸들러
- [ ] Task 2 — 검증 모달에서 에러 클릭 → 탭 자동 전환
- [ ] Task 3 — StoryTab split-view (편집 + 미리보기)
- [ ] Task 4 — Vitest 테스트
- [ ] Run after_task pipeline

### PR-6: 흐름 시뮬레이션 패널
- [ ] Task 1 — FlowSimulationPanel 컴포넌트 (현재 페이즈, 진행도)
- [ ] Task 2 — 다음/이전/처음 버튼 + 노드 하이라이트
- [ ] Task 3 — Vitest 테스트
- [ ] Run after_task pipeline

**Wave 3 gate**:
- [ ] All PR-5 tasks done
- [ ] All PR-6 tasks done
- [ ] `pnpm test` pass
- [ ] Both PRs merged to main
- [ ] User confirmed next wave

---

## Wave 4 — 동적 탭 (sequential)

### PR-7: 동적 탭 (모듈 기반)
- [ ] Task 1 — EDITOR_TABS에 activator 조건 추가
- [ ] Task 2 — EditorTabNav에서 활성 모듈 기반 필터링
- [ ] Task 3 — Vitest 테스트
- [ ] Run after_task pipeline

**Wave 4 gate**:
- [ ] All PR-7 tasks done
- [ ] `pnpm test` pass
- [ ] PR merged to main
- [ ] User confirmed

---

## Phase completion gate

- [ ] All waves done
- [ ] 엣지 삭제 동작 (Delete 키 + 클릭)
- [ ] 분기 조건 설정 → 서버 저장
- [ ] PhaseNodePanel 7+ 필드 편집
- [ ] 프리셋 1클릭 적용
- [ ] 시뮬레이션 페이즈 순회
- [ ] 검증 에러 → 탭 이동
- [ ] 동적 탭 동작
- [ ] Vitest 테스트 유지
- [ ] `/plan-finish` 실행
