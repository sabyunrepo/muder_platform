# PR D-4: Module Palette (드래그 소스)

> Phase D | 의존: D-2 | Wave: W3 (D-3, D-5와 병렬)

---

## 목표
Sidebar에 모듈 팔레트. 드래그앤드롭으로 캔버스에 노드 추가.
Phase D에서는 `phaseNode`만 드래그 가능.

## 변경 파일

**신규**
```
apps/web/src/features/editor/
  components/Sidebar/ModulePalette.tsx   # 모듈 팔레트 (드래그 소스)
  components/Sidebar/ModuleItem.tsx      # 개별 모듈 아이템
  hooks/useDragToCanvas.ts              # DnD: Sidebar → React Flow
```

**수정**
```
apps/web/src/features/editor/
  components/Sidebar/SidebarPanel.tsx   # ModulePalette 통합
  components/Canvas/FlowEditor.tsx      # onDrop 핸들러
  constants.ts                          # MODULE_CATEGORIES → 노드 타입 매핑
```

## ModulePalette 구조

```
┌─ 사이드바 ─────────────┐
│ ▼ 페이즈                 │
│   ┬ 소개  ┬ 토론  ┬ 투표│
│   └ 라운드└ 단서 └ 공개 │
│ ▼ 이벤트 (Phase E)      │
│   ┬ 타이머 ┬ 조건 분기  │
│ ▼ 단서 (Phase E)        │
│   ┬ 단서 정의 ┬ 조합     │
└─────────────────────────┘
```

## 드래그앤드롭 구현

```typescript
// ModuleItem (드래그 소스)
const onDragStart = (e: DragEvent) => {
  e.dataTransfer.setData('application/reactflow-type', module.nodeType);
  e.dataTransfer.setData('application/reactflow-data', JSON.stringify(module.defaults));
};

// FlowEditor (드롭 타겟)
const onDrop = useCallback((e: DragEvent) => {
  const type = e.dataTransfer.getData('application/reactflow-type');
  const data = JSON.parse(e.dataTransfer.getData('application/reactflow-data'));
  const position = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
  addNode({ type, data, position });
}, []);
```

## 모듈 → 노드 타입 매핑 (Phase D 범위)

| 카테고리 | 모듈 | 노드 타입 | 사용 가능 |
|----------|------|-----------|-----------|
| 페이즈 | 소개, 라운드, 토론, 투표, 공개 | `phaseNode` | D-4 |
| 이벤트 | 타이머 | `timerNode` | E (비활성) |
| 이벤트 | 조건 분기 | `conditionNode` | E (비활성) |
| 단서 | 단서 정의 | `clueNode` | E (비활성) |

Phase E에서 활성화되는 모듈은 비활성 상태로 표시 (disabled, tooltip "Phase E에서 사용 가능").

## 테스트

- `ModulePalette.test.tsx`: 카테고리 렌더링, 비활성 모듈 표시
- `ModuleItem.test.tsx`: dragStart 이벤트 데이터
- `FlowEditor.test.tsx` (확장): onDrop → 노드 생성
