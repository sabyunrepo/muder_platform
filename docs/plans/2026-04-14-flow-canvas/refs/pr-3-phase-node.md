# PR-3: Phase 커스텀 노드

> Phase 15.0 | Wave 2 | 의존: PR-1, PR-2

---

## 변경 범위

### 커스텀 노드
- `PhaseNode.tsx`: React Flow 커스텀 노드 (아이콘, 타입, 라벨, 시간)
- Source/Target 핸들 (상단 입력, 하단 출력)
- 선택 시 하이라이트, 삭제 버튼

### 노드 편집 패널
- `PhaseNodePanel.tsx`: 우측 사이드패널 (노드 선택 시)
- 타입 select, 라벨 input, 시간/라운드 input
- 변경 시 debounce → API PATCH

### Start 노드
- `StartNode.tsx`: 시작점 노드 (출력 핸들만, 삭제 불가)
- 테마 생성 시 자동 생성

### 드래그 & 드롭
- FlowToolbar에서 Phase 노드 드래그 → 캔버스 드롭으로 생성
- `onDrop` + `onDragOver` 핸들러

---

## Task 목록

1. **StartNode.tsx** — 시작점 커스텀 노드 (출력만)
2. **PhaseNode.tsx** — Phase 커스텀 노드 (입출력 핸들)
3. **PhaseNodePanel.tsx** — 노드 편집 사이드패널
4. **NodeDetailPanel.tsx** — 노드 타입별 패널 라우팅 (선택 노드)
5. **드래그 & 드롭** — FlowToolbar → 캔버스 드롭 생성
6. **FlowCanvas 연결** — nodeTypes 등록, onNodesChange
7. **테스트** — PhaseNode 렌더링 + 패널 편집

---

## 테스트

- `PhaseNode.test.tsx`: 렌더링, 타입 표시
- `PhaseNodePanel.test.tsx`: 폼 입력 + 변경 콜백
