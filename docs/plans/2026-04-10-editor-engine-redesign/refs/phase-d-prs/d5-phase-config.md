# PR D-5: Phase Config Panel

> Phase D | 의존: D-2 | Wave: W3 (D-3, D-4와 병렬)

---

## 목표
RightPanel에서 선택된 페이즈 노드 상세 설정.
SchemaDrivenForm (C-3) 재사용으로 장르별 설정 자동 생성.

## 변경 파일

**신규**
```
apps/web/src/features/editor/
  components/RightPanel/PhaseConfigPanel.tsx       # 페이즈 설정 패널
  components/RightPanel/ClueDistributionEditor.tsx  # 단서 배포 설정
  components/RightPanel/TransitionConditionEditor.tsx # 전환 조건
  stores/phaseStore.ts                              # 페이즈 상태 (Zustand)
```

**수정**
```
apps/web/src/features/editor/
  components/RightPanel/RightPanel.tsx   # PhaseConfigPanel 통합
  stores/editorUIStore.ts                # selectedNodeId → selectedPhaseId
```

## PhaseConfigPanel 구조

```
┌─ 페이즈 설정 ────────────┐
│ 이름: [라운드 1]          │
│ 유형: [라운드 ▾]          │
│ ─────────────────────── │
│ [SchemaDrivenForm]       │
│   진행 시간: [120] 초    │
│   타이머: [ON/OFF]       │
│ ─────────────────────── │
│ 단서 배포                 │
│   방식: [round ▾]        │
│   단서: [선택...]        │
│ ─────────────────────── │
│ 전환 조건                 │
│   [기본/커스텀]           │
│ ─────────────────────── │
│ [삭제] [복제]            │
└─────────────────────────┘
```

## 공통 Phase Config Schema

```typescript
const COMMON_PHASE_SCHEMA = {
  type: 'object',
  properties: {
    duration: { type: 'integer', minimum: 10, maximum: 3600, default: 120 },
    timerEnabled: { type: 'boolean', default: true },
    timerVisible: { type: 'boolean', default: true },
    skipEnabled: { type: 'boolean', default: false },
    skipThreshold: { type: 'number', minimum: 0.5, maximum: 1.0, default: 0.8 },
  },
};
```

## ClueDistributionEditor

```typescript
interface ClueDistribution {
  method: 'starting' | 'round' | 'timed' | 'conditional' | 'manual';
  round?: number;
  timeAfterPhaseStart?: number;
  clueIds: string[];
  condition?: JsonLogicRule;
}
```

- method 선택 → 하위 필드 동적 표시
- clueIds → ClueList에서 다중 선택
- condition → RuleEditor (D-6)

## TransitionConditionEditor

```typescript
const DEFAULT_TRANSITION = { "==": [{ "var": "phase.timer.remaining" }, 0] };
```

기본: 타이머 만료. 커스텀: RuleEditor로 JSON Logic 작성.

## 테스트

- `PhaseConfigPanel.test.tsx`: 설정 폼, 저장, 복제
- `ClueDistributionEditor.test.tsx`: method별 필드, 단서 선택
- `TransitionConditionEditor.test.tsx`: 기본/커스텀 전환
