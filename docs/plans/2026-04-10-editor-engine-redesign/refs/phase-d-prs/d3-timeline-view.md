# PR D-3: TimelineView (순차 페이즈 편집)

> Phase D | 의존: D-1, D-2 | Wave: W3 (D-4, D-5와 병렬)

---

## 목표
React Flow 위에 비디오 타임라인 형태의 순차 편집.
드래그앤드롭으로 페이즈 순서 변경. 장르별 프리셋 적용.

## 변경 파일

**신규**
```
apps/web/src/features/editor/
  components/Canvas/TimelineView.tsx       # 타임라인 레이어
  hooks/useTimelineLayout.ts               # 수평 자동 배치
  hooks/usePhaseActions.ts                 # 추가/삭제/순서변경
```

**수정**
```
apps/web/src/features/editor/
  components/Canvas/FlowEditor.tsx         # TimelineView 오버레이
  components/StudioLayout.tsx              # L2 기본: TimelineView
```

## TimelineView 구조

```
▶ ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐
  │Intro │──▶│Round1│──▶│ 토론  │──▶│ 투표  │──▶│Reveal│
  └──────┘   └──────┘   └──────┘   └──────┘   └──────┘
       │                     │
       └── [조건부] ─────────┘

  [+ 페이즈 추가]  [프리셋 적용]  [자동 배치]
```

## 배치 알고리즘

```typescript
// 수평: x = sortOrder * (NODE_WIDTH + GAP)
function timelineLayout(nodes: Node[]): Node[] {
  return [...nodes]
    .sort((a, b) => (a.data?.sortOrder ?? 0) - (b.data?.sortOrder ?? 0))
    .map((node, i) => ({ ...node, position: { x: i * 280, y: 0 } }));
}
```

## 페이즈 액션

| 액션 | 설명 |
|------|------|
| 추가 | 장르 기본 페이즈 목록에서 선택 → 노드 추가 |
| 순서 변경 | 드래그앤드롭 → sortOrder 업데이트 |
| 삭제 | 노드 + 연결 엣지 정리 |
| 프리셋 적용 | 장르별 기본 구조 로드 (확인 모달) |
| 자동 배치 | dagre 기반 수평 정렬 |

## 장르별 기본 템플릿

```typescript
const MURDER_MYSTERY_TEMPLATE = [
  { phaseType: 'intro', label: '게임 소개', duration: 60 },
  { phaseType: 'round', label: '라운드 1: 단서 배포', duration: 120 },
  { phaseType: 'discussion', label: '라운드 1: 토론', duration: 300 },
  { phaseType: 'vote', label: '라운드 1: 투표', duration: 60 },
  { phaseType: 'reveal', label: '결과 공개', duration: 60 },
];
```

## 테스트

- `TimelineView.test.tsx`: 렌더링, 드래그 순서 변경, 프리셋 로드
- `useTimelineLayout.test.ts`: 배치 정확성
- `usePhaseActions.test.ts`: 추가/삭제/순서
