# PR-4: Branch 노드 + 커스텀 엣지

> Phase 15.0 | Wave 2 | 의존: PR-1, PR-2

---

## 변경 범위

### Branch 노드
- `BranchNode.tsx`: 다이아몬드 형태 커스텀 노드
- 입력 핸들 1개 (상단), 출력 핸들 N개 (하단/좌우)
- 라벨 표시, 선택 시 조건 편집으로 연결

### 커스텀 엣지
- `ConditionEdge.tsx`: 엣지 위에 조건 라벨 badge 표시
- default 경로: 점선 스타일
- 조건 경로: 실선 + 라벨

### 연결 로직
- `onConnect` 핸들러: 엣지 생성 시 API POST
- 연결 검증: 사이클 방지, 타입 제약 (Start→Phase만, Branch→Phase/Ending만)
- `onEdgesChange`: 엣지 삭제 시 API DELETE

### 노드 타입 등록
- FlowCanvas에 `BranchNode` + `ConditionEdge` 등록

---

## Task 목록

1. **BranchNode.tsx** — 다이아몬드 커스텀 노드
2. **ConditionEdge.tsx** — 조건 라벨 커스텀 엣지
3. **연결 검증 유틸** — 사이클 감지 + 타입 제약
4. **onConnect / onEdgesChange** — API 연동
5. **FlowCanvas 업데이트** — nodeTypes/edgeTypes 등록
6. **테스트** — BranchNode 렌더링, 연결 검증

---

## 테스트

- `BranchNode.test.tsx`: 렌더링, 핸들 개수
- `connectionValidation.test.ts`: 사이클 감지, 타입 제약
