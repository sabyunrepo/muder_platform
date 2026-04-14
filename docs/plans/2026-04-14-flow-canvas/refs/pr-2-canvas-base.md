# PR-2: React Flow 캔버스 기초

> Phase 15.0 | Wave 1 | 의존: 없음

---

## 변경 범위

### 패키지 설치
- `@xyflow/react` v12
- `@xyflow/system` (peer dep)

### 새 컴포넌트
- `FlowCanvas.tsx`: ReactFlow 래퍼, 기본 설정 (배경 그리드, 미니맵, 컨트롤)
- `FlowToolbar.tsx`: 노드 추가 버튼 (Phase/Branch/Ending), 줌 컨트롤
- `useFlowData.ts`: flow API 호출 훅 (useQuery + useMutation)
- `flowApi.ts`: `/themes/{id}/flow` API 클라이언트

### FlowSubTab 연동
- feature flag 체크: on → FlowCanvas, off → 기존 PhaseTimeline
- FlowCanvas를 FlowSubTab 내부에 조건부 렌더링

---

## Task 목록

1. **@xyflow/react 설치** — pnpm add
2. **flowApi.ts** — API 클라이언트 (getFlow, saveFlow, CRUD)
3. **useFlowData.ts** — React Query 훅
4. **FlowCanvas.tsx** — ReactFlow 래퍼 + 배경/미니맵/컨트롤
5. **FlowToolbar.tsx** — 노드 추가 버튼 드롭다운
6. **FlowSubTab 연동** — feature flag 분기
7. **기본 테스트** — FlowCanvas 렌더링 테스트

---

## 테스트

- `FlowCanvas.test.tsx`: 빈 캔버스 렌더링, 미니맵 존재
- `useFlowData.test.ts`: API 호출 모킹
