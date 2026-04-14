# PR-1: 엣지 삭제 + Delete 키

> Wave 1 | 의존: 없음 | Branch: `feat/phase-17.0/PR-1`

## 문제

엣지를 선택하거나 삭제할 수 없음. Delete/Backspace 키 미동작.
ReactFlow의 내장 삭제 기능이 비활성화된 상태.

## 수정 대상

| 파일 | 변경 |
|------|------|
| `design/FlowCanvas.tsx` | `deleteKeyCode`, `edgesFocusable` prop 활성화 |
| `hooks/useFlowData.ts` | onEdgesChange에서 remove 타입 감지 시 autoSave |

## Tasks

### Task 1: FlowCanvas props 활성화
- `<ReactFlow>` 에 `deleteKeyCode="Delete"` 추가
- `edgesFocusable={true}` 추가로 엣지 선택 가능하게
- `edgesReconnectable={true}` 추가로 엣지 재연결 가능하게

### Task 2: useFlowData 엣지 삭제 연동
- `handleEdgesChange`에서 `changes` 중 `type === "remove"` 감지
- 삭제 후 autoSave 트리거 (이미 하고 있으므로 정상 동작 확인)
- 노드 삭제 시 연결된 엣지도 자동 삭제되는지 확인

### Task 3: 테스트
- Delete 키로 선택된 엣지 삭제 Vitest 확인
- 노드 삭제 시 연결 엣지 정리 확인

## 검증

- [ ] 엣지 클릭 → 선택 (하이라이트)
- [ ] 선택 후 Delete/Backspace → 엣지 삭제
- [ ] 삭제 후 autoSave → 서버 반영
- [ ] `pnpm test` pass
