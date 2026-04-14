# PR-2: 분기노드 + 커스텀엣지 등록

> Wave 1 | 의존: 없음 | Branch: `feat/phase-17.0/PR-2`

## 문제

BranchNode, ConditionEdge 컴포넌트가 존재하지만 FlowCanvas에 등록 안 됨.
분기 조건 변경이 서버에 저장되지 않음.

## 수정 대상

| 파일 | 변경 |
|------|------|
| `design/FlowCanvas.tsx` | nodeTypes에 branch 추가, edgeTypes에 condition 추가 |
| `design/NodeDetailPanel.tsx` | onEdgeConditionChange prop 연결 |
| `hooks/useFlowData.ts` | updateEdgeCondition 함수 추가 |

## Tasks

### Task 1: FlowCanvas nodeTypes 확장
- `flowNodeRegistry.ts`에서 export된 branch 타입을 nodeTypes에 병합
- 기존 `{ start, phase, ending }` → `{ start, phase, branch, ending }`

### Task 2: FlowCanvas edgeTypes 등록
- `ConditionEdge`를 edgeTypes에 `{ condition: ConditionEdge }` 등록
- 기본 엣지는 default로 유지, 조건 있는 엣지만 condition 타입 사용

### Task 3: onEdgeConditionChange wiring
- `useFlowData`에 `updateEdgeCondition(edgeId, condition)` 추가
  - 해당 엣지의 data.condition 업데이트 → autoSave
- `FlowCanvas` → `NodeDetailPanel` → `BranchNodePanel` 으로 콜백 전달
- `BranchNodePanel`의 기존 `onEdgeConditionChange` 사용

### Task 4: 테스트
- branch 노드 추가 시 다이아몬드 렌더링 확인
- 조건 설정 → edge data 업데이트 → autoSave 확인
- ConditionEdge 시각적 차별화 (대시 라인) 확인

## 검증

- [ ] 분기 노드 추가 → 다이아몬드 형태 표시
- [ ] 분기 노드 클릭 → BranchNodePanel 표시
- [ ] 조건 설정 → 엣지 data.condition에 저장
- [ ] 조건 엣지 → 대시 라인으로 시각 구분
- [ ] `pnpm test` pass
