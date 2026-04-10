# Phase E: Editor Layer 3 -- Visual Node Editor (Stretch)

> 부모: [../design.md](../design.md)
> 선행: Phase C (Layer 1) + Phase D (Layer 2) 완료

---

## PR 구성 (4 PRs, 순차)

### PR-E1: ConditionNode + ActionNode + EventTriggerNode

**ConditionNode** (`nodes/ConditionNode.tsx`)
- IF/AND/OR 논리 게이트. 입력: `conditions[]` (JSON Logic), 출력: `true`/`false` 핸들
- 파란색 마름모, `handles` 배열로 동적 다중 분기 출력

**ActionNode** (`nodes/ActionNode.tsx`)
- 액션 블록: `distribute_clue`, `set_variable`, `trigger_phase`, `show_modal`, `play_media`
- 녹색 사각형, 입력 1개 + 출력 `success`/`failure` 2개
- ConfigSchema 기반 파라미터 편집

**EventTriggerNode** (`nodes/EventTriggerNode.tsx`)
- 이벤트 소스: `phase_enter`, `clue_discovered`, `vote_complete`, `timer_expired`
- 주황색 육각형, 필터로 특정 페이즈/플레이어/단서 범위 제한

**연결 검증**: `useFlowValidation` 확장 -- ConditionNode 출력 타입과 하위 노드 입력 호환성 검사, EventTriggerNode 순환 참조 방지

---

### PR-E2: Clue Graph View + ClueComboNode

**ClueGraph.tsx** -- 단서 탭 전용 React Flow 캔버스
- `clueStore` → `clueGraphBuilder.ts` → React Flow `nodes[]` + `edges[]` 변환
- 엣지 시각 차별: 실선(의존성) / 점선(조합) / 파선(데이터 참조)

**ClueComboNode** (`nodes/ClueComboNode.tsx`)
- 조합 결과 단서. 보라색 원형. 입력: 재료 단서 ID (2-5개), 출력: 결과 단서
- 드래그앤드롭으로 재료 연결, 우측 패널에서 조합 규칙 편집

**상호작용**: 노드 더블클릭→상세 편집, 엣지 생성→clueStore 자동 갱신, 순환 참조 실시간 경고(빨간 엣지)

---

### PR-E3: dagre Auto-Layout

**useAutoLayout.ts**
- dagre 기반 위상 정렬 배치. 방향: LR(기본) / TB(타임라인)
- 알고리즘: StartNode→첫 랭크, 위상 정렬→랭크 할당, 연결 밀도로 정렬, dagre 좌표 계산
- 단서 그래프 전용: 의존성 기반 위→아래, 조합 노드=재료 아래 위치

```tsx
interface AutoLayoutOptions {
  direction: 'LR' | 'TB';
  nodeSpacing: number;    // 기본 80px
  rankSpacing: number;    // 기본 120px
  animate: boolean;       // 전환 애니메이션
}
```

---

### PR-E4: PreviewEngine + Undo/Redo

**PreviewEngine.tsx** -- 에디터 내 미니 게임 엔진 (서버 통신 없음)
- Phase A의 `Validate`+`Apply`를 클라이언트에서 재현
- 시뮬레이션: 2-6명 가상 플레이어, 노드 하이라이팅, 변수/단서 상태 실시간 패널
- 컨트롤: 재생/일시정지/스텝/리셋, 속도 0.5x/1x/2x

**Undo/Redo** (immer + zustand)
- `flowStore`에 immer 미들웨어, 언두 스택 최대 50단계
- 기록: 노드/엣지 CRUD, 노드 데이터 변경 | 제외: 줌/팬, 선택, UI 토글
- 단축키: `Ctrl+Z` / `Ctrl+Shift+Z`

---

## 테스트 전략

| 항목 | 방법 |
|------|------|
| 렌더링 성능 | 노드 100 + 엣지 200, `onlyRenderVisibleElements` 벤치마크 60fps |
| 순환 참조 | `DetectCycles()` 정확성 단위 테스트 |
| 배치 정확성 | dagre 출력이 위상 정렬 순서와 일치하는지 검증 |
| PreviewEngine | "3라운드 범인 지목" 클라이언트 E2E |
| Undo/Redo | 50단계 연속 편집 후 롤백/리두 일관성 |

---

## 수용 기준

- [ ] ConditionNode/ActionNode/EventTriggerNode이 ConfigSchema 폼과 연동
- [ ] 단서 그래프 뷰에서 의존성/조합 엣지 시각적 구분
- [ ] dagre 배치가 위상 정렬 순서 준수
- [ ] PreviewEngine이 3라운드 시나리오 에러 없이 시뮬레이션
- [ ] Undo/Redo 50단계 정확 동작 + 노드 100+엣지 200에서 60fps 유지
