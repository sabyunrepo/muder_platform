# Phase 17.0 — Execution Model (Wave DAG)

## Wave 의존성 그래프

```
Wave 1 (parallel): PR-1 엣지삭제+Delete, PR-2 분기노드+커스텀엣지 등록
  ↓
Wave 2 (parallel): PR-3 PhaseNodePanel 강화, PR-4 흐름 프리셋
  ↓
Wave 3 (parallel): PR-5 검증→탭이동 + 스토리 split-view, PR-6 시뮬레이션 패널
  ↓
Wave 4 (sequential): PR-7 동적 탭 (모듈 기반)
```

## PR별 파일 스코프

| PR | Wave | 파일 스코프 |
|----|------|------------|
| PR-1 | W1 | `hooks/useFlowData.ts`, `design/FlowCanvas.tsx` |
| PR-2 | W1 | `design/FlowCanvas.tsx`, `design/flowNodeRegistry.ts`, `design/NodeDetailPanel.tsx` |
| PR-3 | W2 | `design/PhaseNodePanel.tsx`, `flowTypes.ts`, 새 `design/ActionListEditor.tsx` |
| PR-4 | W2 | `design/FlowToolbar.tsx`, 새 `hooks/flowPresets.ts` |
| PR-5 | W3 | `StoryTab.tsx`, 검증 UI, `EditorLayout.tsx` |
| PR-6 | W3 | 새 `design/FlowSimulationPanel.tsx`, `design/FlowCanvas.tsx` |
| PR-7 | W4 | `constants.ts`, `EditorTabNav.tsx` |

## 스코프 충돌 분석

| 파일 | 접촉 PR | 충돌 위험 |
|------|---------|----------|
| `FlowCanvas.tsx` | PR-1, PR-2, PR-6 | PR-1/PR-2는 W1 병렬 — **주의**: 같은 파일 수정 |
| `useFlowData.ts` | PR-1 | 단독 |
| `flowTypes.ts` | PR-3 | 단독 |
| `constants.ts` | PR-7 | 단독 |

**W1 충돌 완화**: PR-1은 `useFlowData.ts` + FlowCanvas의 `deleteKeyCode` prop만.
PR-2는 FlowCanvas의 `nodeTypes`/`edgeTypes` + NodeDetailPanel wiring.
수정 영역이 다르므로 병렬 안전.

## 예상 규모

| Wave | 예상 시간 | 신규 파일 | 수정 파일 |
|------|----------|----------|----------|
| W1 | 소 | 0 | 3 |
| W2 | 중 | 2 | 3 |
| W3 | 중 | 1 | 3 |
| W4 | 소 | 0 | 2 |
| **합계** | - | **3** | **11** |
