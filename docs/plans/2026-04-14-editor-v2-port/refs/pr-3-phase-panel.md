# PR-3: PhaseNodePanel 강화

> Wave 2 | 의존: PR-1, PR-2 | Branch: `feat/phase-17.0/PR-3`

## 문제

PhaseNodePanel에 4개 필드만 존재 (라벨, 타입, 시간, 라운드).
v2는 자동진행, 경고타이머, onEnter/onExit 액션(7종)을 지원.

## 수정 대상

| 파일 | 변경 |
|------|------|
| `flowTypes.ts` | FlowNodeData에 autoAdvance, warningAt, onEnter, onExit 추가 |
| `design/PhaseNodePanel.tsx` | 자동진행 토글, 경고타이머, 액션 섹션 추가 |
| 새 `design/ActionListEditor.tsx` | onEnter/onExit 액션 편집 UI |

## v2 참고

- `PhaseDetailPanel.tsx:48-126` — ActionList (타입: broadcast, enable_voting 등 7종)
- `PhaseDetailPanel.tsx:128-256` — 전체 패널 레이아웃

## Tasks

### Task 1: FlowNodeData 타입 확장
```typescript
autoAdvance?: boolean;
warningAt?: number;    // 경고 타이머 (초)
onEnter?: PhaseAction[];
onExit?: PhaseAction[];
```
`PhaseAction` 타입 정의: `{ type: string; params?: Record<string, unknown> }`

### Task 2: PhaseNodePanel UI 추가
- 자동진행 토글 (Switch)
- 경고 타이머 입력 (autoAdvance 활성 시에만 표시)
- 200줄 제한 주의 — 액션 부분은 서브컴포넌트로 분리

### Task 3: ActionListEditor 컴포넌트
- onEnter / onExit 두 섹션
- 액션 추가/삭제 버튼
- 액션 타입 선택 (broadcast, enable_voting, disable_chat, play_bgm 등)
- 액션별 파라미터 폼

### Task 4: 테스트
- autoAdvance 토글 → data.autoAdvance 업데이트 확인
- 액션 추가/삭제 동작 확인

## 검증

- [ ] 7+ 필드 편집 가능
- [ ] 액션 추가/삭제 정상
- [ ] autoSave로 서버 저장
- [ ] `pnpm test` pass
