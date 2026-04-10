# PR D-1: React Flow Canvas + FlowEditor Setup

> Phase D | 의존: C-1 | Wave: W1

---

## 목표
`@xyflow/react` 도입. FlowEditor 컴포넌트로 React Flow 캔버스 래핑.
`onlyRenderVisibleElements`로 200노드 성능 보장.

## 변경 파일

**신규**
```
apps/web/src/features/editor/
  components/Canvas/FlowEditor.tsx     # React Flow 래퍼
  stores/flowStore.ts                  # nodes/edges 상태 (Zustand + immer)
  hooks/useFlowKeyboard.ts             # Delete, Ctrl+Z/Y 핸들러
  utils/flowSerializer.ts              # nodes/edges ↔ JSON
```

**수정**
```
apps/web/src/features/editor/
  components/StudioLayout.tsx          # Canvas: L2 → FlowEditor
  package.json                         # @xyflow/react, @dagrejs/dagre, immer
```

## FlowEditor 핵심 설정

```tsx
<ReactFlow
  nodes={nodes} edges={edges}
  onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
  onConnect={onConnect}
  nodeTypes={nodeTypes} edgeTypes={edgeTypes}
  onlyRenderVisibleElements={true}   // 200노드 성능 보장
  minZoom={0.1} maxZoom={2}
  snapToGrid={[16, 16]}
  fitView
>
  <Background gap={16} size={1} />
  <MiniMap nodeColor={(n) => phaseColors[n.data?.phaseType]} />
  <Controls />
</ReactFlow>
```

## flowStore (Zustand + immer)

```typescript
interface FlowState {
  nodes: Node[]; edges: Edge[];
  onNodesChange: OnNodesChange; onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: Node) => void;
  removeNode: (id: string) => void;
  updateNodeData: (id: string, data: Partial<NodeData>) => void;
  undo: () => void; redo: () => void;
  canUndo: boolean; canRedo: boolean;  // 50스텝 제한
}
```

## flowSerializer

- `serializeFlow(nodes, edges) → FlowJson`: config_json.flow_layout에 저장
- `deserializeFlow(json) → { nodes, edges }`: 테마 로드 시 복원

## 키보드 단축키

| 단축키 | 동작 |
|--------|------|
| Delete/Backspace | 선택 노드 삭제 |
| Ctrl+Z | 언두 |
| Ctrl+Y | 리두 |
| Ctrl+A | 전체 선택 |
| Escape | 선택 해제 |

## 테스트

- `FlowEditor.test.tsx`: 캔버스 렌더링, 노드 추가/삭제
- `flowStore.test.ts`: 언두/리두 50스텝, CRUD
- `flowSerializer.test.ts`: 직렬화/역직렬화 round-trip
- **성능**: 노드 100 + 엣지 200 렌더링 < 16ms/frame
