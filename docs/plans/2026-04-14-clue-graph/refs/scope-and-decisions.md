# Phase 17.5 — Scope + 결정 상세

## 백엔드: 단서 관계 API

### 현황
- `internal/clue/graph.go` — Graph, Add, AddDependency, Resolve, DAG cycle 감지
- `internal/clue/validator.go` — orphan, cycle, unreachable 검증
- `internal/clue/visibility.go` — 플레이어별 가시성 계산
- **없는 것**: HTTP 핸들러, sqlc 쿼리, DB 테이블

### DB 설계: clue_relations 테이블
```sql
CREATE TABLE clue_relations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id   UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  source_id  UUID NOT NULL REFERENCES clues(id) ON DELETE CASCADE,
  target_id  UUID NOT NULL REFERENCES clues(id) ON DELETE CASCADE,
  mode       TEXT NOT NULL DEFAULT 'AND' CHECK (mode IN ('AND', 'OR')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (theme_id, source_id, target_id)
);
```
- source → target: "source를 발견해야 target 해금 가능"
- mode: AND(모든 source 필요) / OR(하나만 필요)

### API 엔드포인트
- `GET /v1/editor/themes/:id/clue-relations` → `[]ClueRelation`
- `PUT /v1/editor/themes/:id/clue-relations` → 전체 교체 (upsert 패턴)
- 서버 측 cycle 검증: 저장 전 graph.Validate() 호출, 실패 시 400

---

## 프론트엔드: ClueRelationGraph

### 컴포넌트 구조
```
CluesTab
  ├── ClueListPanel (기존)
  └── ClueRelationGraph (신규 서브탭)
        ├── ReactFlow 캔버스 (단서=노드, 관계=엣지)
        ├── ClueNode (커스텀 노드: 이름 + 아이콘)
        └── RelationEdge (AND=실선, OR=점선)
```

### 데이터 흐름
1. useClueRelations(themeId) → 서버에서 관계 목록 fetch
2. useEditorClues(themeId) → 단서 목록 fetch (노드)
3. 두 데이터를 ReactFlow nodes/edges로 변환
4. onConnect → 관계 추가 → cycle 체크 → autoSave
5. onEdgeDelete → 관계 삭제 → autoSave

### FlowCanvas 패턴 재사용
- `useClueGraphData` hook (useFlowData 패턴 복제)
- `deleteKeyCode="Delete"`, `edgesFocusable={true}` (Phase 17.0과 동일)
- autoSave debounce 1초

---

## 검증 연동

### validateClueGraph 추가
- 기존 `validateGameDesign` 확장 or 별도 함수
- 카테고리: `clue_graph`
- 체크 항목: cycle 존재, orphan 단서 (관계 없는 단서), unreachable 단서

### ERROR_TAB_MAP 확장
```typescript
clue_graph: 'clues'  // 단서 탭으로 이동
```
