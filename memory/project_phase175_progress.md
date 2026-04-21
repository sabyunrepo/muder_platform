---
name: Phase 17.5 완료 — 단서 관계 그래프
description: 단서 간 의존 관계 DAG 편집 + 시각화 완료 (4 PRs, 3 Waves, 12 Vitest + 4 Go tests, 2026-04-14)
type: project
---
# Phase 17.5 완료

**시작**: 2026-04-14 | **완료**: 2026-04-15 | **상태**: archived

## 산출물 (3 Wave, 4 PR)

### W1 PR-1 — 백엔드 API
- `db/migrations/00022_clue_relations.sql` — theme_id/source_id/target_id/mode, FK cascade, UNIQUE
- `db/queries/clue_relation.sql` + sqlc generated
- `internal/domain/editor/clue_relation_{handler,service}.go`
- GET/PUT `/v1/editor/themes/{id}/clue-relations`
- cycle 검증 (`clue.Graph.HasCycle` 재사용)

### W2 PR-2 — ReactFlow UI (병렬)
- `clueRelationApi.ts` (useClueRelations, useSaveClueRelations, clueRelationKeys)
- `hooks/useClueGraphData.ts` (단서→노드/관계→엣지 + autoSave debounce 1s)
- `components/clues/{ClueRelationGraph,ClueNode,RelationEdge,ClueListView}.tsx`
- CluesTab에 서브탭 추가 (목록/관계)
- AND=실선 amber, OR=점선 blue

### W2 PR-3 — 검증 연동 (병렬)
- `validation.ts`의 `DesignWarning` category에 `clue_graph` 추가
- `validateClueGraph` (Kahn's algorithm cycle + self-ref + orphan)
- ValidationPanel ERROR_TAB_MAP 확장
- ThemeEditor handleValidate 통합

### W3 PR-4 — 통합 + 폴리시
- UX 폴리시 (에러 롤백, 로딩/저장 상태, 빈 상태 메시지)
- E2E 스켈레톤 `e2e/clue-relation.spec.ts`

## 코드 리뷰 Fix-Loop (8개 이슈)

### 보안 (H-1/H-3/H-6/H-7)
- **IDOR 차단**: 서버에서 source/target ID가 themeID 소유인지 검증
- 요청 크기 1MB + 관계 500개 상한
- 자기참조 + mode enum 서버측 검증

### 성능 (H-2)
- N+1 INSERT → `unnest()` bulk insert (1 round-trip)

### 데이터 (H-4/H-5/H-8)
- useNodesState setter 복원 → clue 변경 시 노드 동기화 정상 작동
- ThemeEditor 중복 useQuery/타입 제거 → canonical useClueRelations
- onEdgesDelete prop 연결 → 엣지 삭제 서버 저장

### UX (M-6/M-7)
- 테스트 문구 mismatch 수정
- onConnect 에러 분기 (CYCLE_DETECTED vs 기타)

## 교훈

1. **Worktree 분기 타이밍**: W2 worktree가 PR-1 머지 전에 분기돼 diff가 혼란스럽게 보였지만, 파일 스코프가 겹치지 않아 3-way merge는 깔끔. 병렬 PR은 파일 스코프 엄격히 나누면 안전.
2. **useNodesState destructuring 함정**: `const [nodes, , onNodesChange]`처럼 setter를 버리면 외부 prop 변화에 동기화 불가. ReactFlow hook 사용 시 명시적 setter 필수.
3. **DB FK는 소유권을 보장하지 않음**: `source_id REFERENCES theme_clues(id)`는 존재만 보장. 같은 theme_id 내 clue인지는 애플리케이션 레이어에서 검증해야 함.
4. **sqlc unnest array pattern**: Params struct는 Column2/3/4 형태로 생성됨 — 실제 생성 후 필드명 확인 필수.
5. **리뷰 4병렬 에이전트 효과**: 보안/성능/아키텍처/테스트로 나눠 병렬 실행 → 단일 리뷰 대비 8개 HIGH 이슈 조기 발견. fix-loop 1회로 전부 해결.

## 파일 크기
모든 파일 <200줄 (최대 178줄 useClueGraphData.ts).

## 남은 cleanup 후보 (Phase 18.0 또는 followup)
- types.go 컨벤션 정립 (ClueRelationRequest/Response 분리)
- 서비스 통합 테스트 + useClueGraphData 단위 테스트 추가
- onConnect debounce 중복 제거 (autoSave 일원화)
- clue 삭제 시 clueRelations 크로스 invalidation
- E2E MSW mock 도입 (CI 무조건 실행)
- Kahn queue O(n²) → index pointer
