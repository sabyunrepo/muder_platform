# Phase 17.5 — Execution Model (Wave DAG)

## Wave DAG

```
W1: PR-1 (backend API)
 ↓
W2: PR-2 (graph UI) ║ PR-3 (validation)   ← parallel
 ↓
W3: PR-4 (integration + E2E)
```

## 파일 스코프 (충돌 분석)

### PR-1 (backend)
```
apps/server/db/migrations/NNNN_clue_relations.sql
apps/server/db/query/clue_relation.sql
apps/server/internal/repository/clue_relation.go
apps/server/internal/service/clue_relation_service.go
apps/server/internal/handler/clue_relation_handler.go
apps/server/internal/handler/clue_relation_handler_test.go
apps/server/cmd/server/routes.go (1줄 추가)
```

### PR-2 (frontend graph)
```
apps/web/src/features/editor/clueRelationApi.ts
apps/web/src/features/editor/hooks/useClueGraphData.ts
apps/web/src/features/editor/components/clues/ClueRelationGraph.tsx
apps/web/src/features/editor/components/clues/ClueNode.tsx
apps/web/src/features/editor/components/clues/RelationEdge.tsx
apps/web/src/features/editor/components/CluesTab.tsx (서브탭 추가)
```

### PR-3 (validation)
```
apps/web/src/features/editor/validation.ts (확장)
apps/web/src/features/editor/components/ValidationPanel.tsx (카테고리 추가)
apps/web/src/features/editor/__tests__/validation.test.ts (확장)
```

### PR-4 (integration)
```
apps/web/e2e/clue-relation.spec.ts (신규)
apps/web/src/features/editor/components/clues/__tests__/ (추가)
```

## 충돌 분석

| PR-2 vs PR-3 | 겹침 없음 |
|--------------|---------|
| PR-2 scope | clues/ 컴포넌트 + hooks |
| PR-3 scope | validation.ts + ValidationPanel |
| 결론 | **병렬 안전** ✅ |

## 모델 오버라이드

| PR | Model | 이유 |
|----|-------|------|
| PR-1 | sonnet | Go CRUD 패턴 반복 |
| PR-2 | sonnet | ReactFlow 패턴 (Phase 17.0 복제) |
| PR-3 | sonnet | 검증 로직 단순 |
| PR-4 | sonnet | E2E + 폴리시 |
