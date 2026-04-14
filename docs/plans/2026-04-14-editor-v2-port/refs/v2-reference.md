# Phase 17.0 — v2 참고 파일 경로 맵

> v2 경로: `/Users/sabyun/goinfre/merdermistery_hotel`

## 흐름 에디터

| 파일 | 내용 | 참조 PR |
|------|------|---------|
| `apps/web/src/components/editor/tabs/GameFlowTab.tsx` | 흐름 에디터 메인 (프리셋, 시뮬레이션) | PR-4, PR-6 |
| `apps/web/src/components/editor/panels/PhaseDetailPanel.tsx` | 페이즈 상세 패널 (ActionList) | PR-3 |
| `apps/web/src/components/editor/edges/DeletableEdge.tsx` | 삭제 가능 엣지 | PR-1 |

## 모듈/탭

| 파일 | 내용 | 참조 PR |
|------|------|---------|
| `apps/web/src/components/editor/EditorLayout.tsx` | 동적 탭 + 검증 에러 탭 이동 | PR-5, PR-7 |
| `apps/web/src/components/editor/tabs/ModuleSelectorTab.tsx` | 모듈 선택 + 인라인 설정 | 참고용 |

## UX

| 파일 | 내용 | 참조 PR |
|------|------|---------|
| `apps/web/src/components/editor/ValidationModal.tsx` | 검증 모달 + ERROR_TAB_MAP | PR-5 |
| `apps/web/src/components/editor/tabs/StoryTab.tsx` | 스토리 split-view | PR-5 |

## 단서 (Phase 17.x 후속)

| 파일 | 내용 |
|------|------|
| `apps/web/src/components/editor/tabs/ClueTreeTab.tsx` | 단서 관계 그래프 |
| `apps/web/src/components/editor/hooks/useClueTreeGraph.ts` | 그래프 데이터 hook |
