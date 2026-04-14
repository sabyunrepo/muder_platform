# Phase 17.0 — 에디터 UX v2 이식 + 흐름 에디터 완성 실행 계획 (index)

> 부모: [design.md](design.md)
> MD 200줄 제한: 각 PR 상세는 `refs/pr-N-*.md`

---

## Overview

v2 에디터에서 우수한 UX를 v3로 이식하고, Phase 15.0의 미연결 흐름 컴포넌트를 완성한다.
프론트엔드 전용 (백엔드 API 변경 없음, JSONB data 활용).

---

## Wave 구조

```
Wave 1 (parallel): PR-1 엣지삭제, PR-2 분기+커스텀엣지
  ↓
Wave 2 (parallel): PR-3 PhasePanel 강화, PR-4 흐름프리셋
  ↓
Wave 3 (parallel): PR-5 검증+스토리, PR-6 시뮬레이션
  ↓
Wave 4 (sequential): PR-7 동적탭
```

| Wave | Mode | PRs | 의존 | 예상 |
|------|------|-----|------|------|
| W1 | parallel | PR-1, PR-2 | - | 소 |
| W2 | parallel | PR-3, PR-4 | W1 | 중 |
| W3 | parallel | PR-5, PR-6 | W2 | 중 |
| W4 | sequential | PR-7 | W3 | 소 |

---

## PR 목록

| PR | Wave | Title | 의존 | Scope | Tasks | 상세 |
|----|------|-------|------|-------|-------|------|
| PR-1 | W1 | 엣지 삭제 + Delete 키 | - | useFlowData, FlowCanvas | 3 | [refs/pr-1-edge-delete.md](refs/pr-1-edge-delete.md) |
| PR-2 | W1 | 분기노드 + 커스텀엣지 등록 | - | FlowCanvas, NodeDetailPanel | 4 | [refs/pr-2-branch-wiring.md](refs/pr-2-branch-wiring.md) |
| PR-3 | W2 | PhaseNodePanel 강화 | PR-1,2 | PhaseNodePanel, flowTypes | 4 | [refs/pr-3-phase-panel.md](refs/pr-3-phase-panel.md) |
| PR-4 | W2 | 흐름 프리셋 시스템 | PR-1,2 | FlowToolbar, flowPresets | 3 | [refs/pr-4-flow-presets.md](refs/pr-4-flow-presets.md) |
| PR-5 | W3 | 검증→탭이동 + 스토리 split-view | PR-3,4 | 검증UI, StoryTab | 4 | [refs/pr-5-validation-story.md](refs/pr-5-validation-story.md) |
| PR-6 | W3 | 흐름 시뮬레이션 패널 | PR-3,4 | FlowSimulationPanel | 3 | [refs/pr-6-simulation.md](refs/pr-6-simulation.md) |
| PR-7 | W4 | 동적 탭 (모듈 기반) | PR-5,6 | constants, EditorTabNav | 3 | [refs/pr-7-dynamic-tabs.md](refs/pr-7-dynamic-tabs.md) |

---

## Merge 전략

- Wave 내 병렬 PR은 `isolation: worktree`
- 머지는 PR 번호 순 sequential
- 각 머지 후 `pnpm test` gate
- Wave 종료 시 user 확인 1회

---

## Feature flag

없음. 에디터 내부 UX 개선이라 feature flag 불필요.

---

## 알려진 위험

| 위험 | 완화 |
|------|------|
| PR-1/PR-2 FlowCanvas 동시 수정 | 수정 영역 분리 (props vs nodeTypes) |
| PhaseNodePanel 확장으로 200줄 초과 | 서브컴포넌트 분할 (ActionListEditor) |
| 시뮬레이션이 실제 게임 로직과 불일치 | 프론트 전용 워크스루, 백엔드 로직 미반영 명시 |

---

## 후속

- **Phase 17.x**: 단서 관계 그래프 (백엔드 API + ClueTreeTab)
- **Phase 18.0**: 게임 런타임 통합
