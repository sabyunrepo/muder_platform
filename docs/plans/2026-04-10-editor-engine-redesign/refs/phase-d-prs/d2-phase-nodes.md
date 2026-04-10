# PR D-2: PhaseNode + PhaseEdge Custom

> Phase D | 의존: D-1 | Wave: W2

---

## 목표
페이즈 타입별 커스텀 노드/엣지. 장르별 기본 페이즈 템플릿 시각화.

## 변경 파일

**신규**
```
apps/web/src/features/editor/
  components/Canvas/nodes/PhaseNode.tsx     # 페이즈 노드
  components/Canvas/nodes/StartNode.tsx     # 게임 시작 (원형)
  components/Canvas/nodes/EndNode.tsx       # 게임 종료 (마름모)
  components/Canvas/edges/PhaseTransitionEdge.tsx  # 전환 엣지
  constants/nodeTypes.ts                    # nodeTypes/edgeTypes 레지스트리
  constants/phaseColors.ts                  # 타입별 색상 매핑
```

## 노드 레지스트리

```typescript
const nodeTypes = { phaseNode: PhaseNode, startNode: StartNode, endNode: EndNode };
const edgeTypes = { phaseTransition: PhaseTransitionEdge };
```

## PhaseNodeData

```typescript
interface PhaseNodeData {
  label: string;
  phaseType: 'intro' | 'round' | 'discussion' | 'vote' | 'reveal' | 'custom';
  phaseId: string;
  config: Record<string, unknown>;
  duration: number;
  timerEnabled: boolean;
  clueDistribution?: { method: string; clueIds: string[] };
  transitionCondition?: JsonLogicRule;
}
```

## PhaseNode 렌더링

```
┌─────────────────────────┐
│ ● [phaseType 아이콘]     │
│ 페이즈 이름              │
│ 120초 ⏱ | 단서 3개      │
│ ─────────────────────── │
│ [조건부 전환 ▸]          │
└─────────────────────────┘
```

타입별 색상: intro(amber), round(slate), discussion(blue), vote(purple), reveal(emerald)

## PhaseTransitionEdge

- 조건 없는 전환: 실선
- 조건부 전환: 애니메이션 점선 + 조건 요약 라벨
- StartNode: 원형, 삭제 불가, 항상 1개
- EndNode: 마름모, 조건부 분기 가능

## 테스트

- `PhaseNode.test.tsx`: 모든 phaseType 렌더링, 선택, 핸들
- `PhaseTransitionEdge.test.tsx`: 애니메이션, 조건 라벨
- `StartNode.test.tsx`, `EndNode.test.tsx`: 기본 렌더링
