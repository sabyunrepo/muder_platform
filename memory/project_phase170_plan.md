---
name: Phase 17.0 완료
description: 에디터 UX v2 이식 + 흐름 에디터 완성 — 7 PR, 4 Wave, 353 tests, 완료+archived
type: project
---
Phase 17.0 — **완료** (2026-04-14)

## 결과
7 PRs, 4 Waves 전체 완료. 353 에디터 테스트 통과. 코드 리뷰 수정 완료.
태그: `phase-17.0`

## Wave 결과
| Wave | PRs | 내용 | 테스트 |
|------|-----|------|--------|
| W1 | PR-1, PR-2 | 엣지 삭제+Delete, 분기노드+커스텀엣지 | 328 |
| W2 | PR-3, PR-4 | PhaseNodePanel 7+필드, 흐름 프리셋 3종 | 340 |
| W3 | PR-5, PR-6 | 검증→탭이동+ValidationPanel, 시뮬레이션 | 349 |
| W4 | PR-7 | 동적 탭 (모듈 기반) | 353 |

## 새 파일 17개
컴포넌트: ActionListEditor, FlowSimulationPanel, ValidationPanel, TabContent
Hooks: useEdgeCondition, useApplyPreset, flowPresets
테스트 7개

## 코드 리뷰 수정
- nodesRef 스테일 클로저, 토폴로지 순환 감지, dismissed 닫기, stable key, ARIA, 타입 단언

## 후속
- Phase 17.x: 단서 관계 그래프 (백엔드 API + ClueTreeTab)
- Phase 18.0: 게임 런타임 통합

## Plan 경로
`docs/plans/2026-04-14-editor-v2-port/`
