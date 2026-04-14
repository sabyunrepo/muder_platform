# PR-2: ClueRelationGraph 컴포넌트

> Wave 2 | 의존: PR-1 | Branch: `feat/phase-17.5/PR-2`

## 목표

에디터 단서 탭에 "관계" 서브탭을 추가하고,
ReactFlow DAG로 단서 간 의존 관계를 시각화/편집한다.

## 수정 대상

| 파일 | 변경 |
|------|------|
| 신규 `clueRelationApi.ts` | GET/PUT hooks |
| 신규 `hooks/useClueGraphData.ts` | ReactFlow 변환 + autoSave |
| 신규 `components/clues/ClueRelationGraph.tsx` | 메인 캔버스 |
| 신규 `components/clues/ClueNode.tsx` | 커스텀 노드 (이름+타입) |
| 신규 `components/clues/RelationEdge.tsx` | AND=실선, OR=점선 |
| 수정 `components/CluesTab.tsx` | 서브탭 ("목록" / "관계") |

## Tasks

### Task 1: clueRelationApi.ts
- `useClueRelations(themeId)` — GET /clue-relations
- `useSaveClueRelations(themeId)` — PUT /clue-relations
- queryKey: `editorKeys.clueRelations(themeId)`

### Task 2: ClueRelationGraph + useClueGraphData
- useClueGraphData: 단서→노드, 관계→엣지 변환
- 자동 레이아웃 (좌→우 dagre 또는 단순 그리드)
- onConnect → 관계 추가 (cycle 체크 후)
- onEdgeDelete → 관계 삭제
- autoSave debounce 1초

### Task 3: CluesTab 서브탭 추가
- 기존 단서 목록을 "목록" 서브탭으로
- 새 "관계" 서브탭에 ClueRelationGraph
- 서브탭 네비게이션 (모듈/흐름/장소 패턴 복제)

### Task 4: Vitest 테스트
- 단서 노드 렌더링 확인
- 엣지 AND/OR 시각 차별화 확인
- cycle 감지 시 에러 표시 확인

## 검증
- [ ] 단서 노드가 DAG로 표시
- [ ] 엣지 추가/삭제 → autoSave
- [ ] AND=실선, OR=점선 구분
- [ ] `pnpm test` pass
