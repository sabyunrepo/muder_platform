# Phase 17.0 — Scope + 결정 상세

## W1: 흐름 에디터 Wiring (기존 컴포넌트 연결)

### 이슈 1: 엣지 삭제 + Delete 키 바인딩
**현상**: 엣지를 선택/삭제할 수 없음. Delete 키 미동작.
**근본 원인**: `useFlowData.ts`에 `deleteEdge` 함수 없음. 키보드 이벤트 핸들러 없음.
**수정**: ReactFlow `deleteKeyCode` prop + `onEdgesChange`에서 remove 타입 감지 → autoSave.
**관련 파일**: `useFlowData.ts`, `FlowCanvas.tsx`

### 이슈 2: 커스텀 엣지/분기노드 미등록
**현상**: BranchNode가 캔버스에 추가되지만 기본 노드로 렌더링. ConditionEdge 미사용.
**근본 원인**: `FlowCanvas.tsx`에서 `nodeTypes`에 branch 미포함. `edgeTypes` prop 미설정.
**수정**: `flowNodeRegistry.ts`의 타입을 FlowCanvas에 등록.
**관련 파일**: `FlowCanvas.tsx`, `flowNodeRegistry.ts`

### 이슈 3: 분기 조건 서버 저장
**현상**: BranchNodePanel에서 조건 설정해도 저장 안 됨.
**근본 원인**: `onEdgeConditionChange` 콜백이 FlowCanvas→useFlowData에 미연결.
**수정**: useFlowData에 `updateEdgeCondition` 추가 → autoSave 경유.
**관련 파일**: `useFlowData.ts`, `FlowCanvas.tsx`, `NodeDetailPanel.tsx`

---

## W2: 흐름 에디터 강화

### 이슈 4: PhaseNodePanel 필드 부족
**현상**: 4개 필드만 (라벨, 타입, 시간, 라운드). v2는 7+ 필드.
**수정**: autoAdvance, warningAt, onEnter/onExit 액션 추가.
**v2 참고**: `PhaseDetailPanel.tsx:128-256`
**관련 파일**: `PhaseNodePanel.tsx`, `flowTypes.ts`, 새 `ActionListEditor.tsx`

### 이슈 5: 흐름 프리셋 시스템
**현상**: 빈 캔버스에서 시작. v2는 프리셋 1클릭 적용.
**수정**: 클래식/타임어택/자유탐색 프리셋 + 툴바 드롭다운.
**v2 참고**: `GameFlowTab.tsx:42-67`
**관련 파일**: `FlowToolbar.tsx`, 새 `flowPresets.ts`

---

## W3: UX 이식

### 이슈 6: 검증 에러 → 탭 자동 이동
**현상**: 검증 에러 목록만 표시. 클릭해도 해당 탭으로 안 감.
**수정**: ERROR_TAB_MAP + onErrorClick 핸들러.
**v2 참고**: `ValidationModal.tsx:17-35`
**관련 파일**: 검증 UI 컴포넌트, `EditorLayout.tsx`

### 이슈 7: 스토리 split-view
**현상**: 단일 뷰. v2는 마크다운 편집 + 실시간 미리보기.
**수정**: 좌/우 split 레이아웃 + 마크다운 렌더링.
**v2 참고**: `StoryTab.tsx:117-205`
**관련 파일**: `StoryTab.tsx`

---

## W3~W4: 시각화 + 동적 탭

### 이슈 8: 흐름 시뮬레이션 패널
**현상**: 흐름 미리보기 없음. v2는 진행도/현재 페이즈/다음 버튼.
**수정**: 새 FlowSimulationPanel 컴포넌트.
**v2 참고**: `GameFlowTab.tsx:103-253`
**관련 파일**: `FlowCanvas.tsx`, 새 `FlowSimulationPanel.tsx`

### 이슈 9: 동적 탭 (모듈 기반)
**현상**: 8개 고정 탭. 미사용 탭도 항상 보임.
**수정**: 활성 모듈 기반 탭 필터링.
**v2 참고**: `EditorLayout.tsx:38-63`
**관련 파일**: `constants.ts`, `EditorTabNav.tsx`
