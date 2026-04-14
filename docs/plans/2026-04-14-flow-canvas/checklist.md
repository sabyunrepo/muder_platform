<!-- STATUS: {"phase":"15.0","wave":"W4","pr":"PR-8","task":"","state":"done"} -->
# Phase 15.0 — React Flow 게임 흐름 에디터 체크리스트

> 부모: [design.md](design.md) | 실행: [plan.md](plan.md)

---

## Wave 1 — DB + 캔버스 기초 (parallel)

### PR-1: DB 스키마 + Go API ✅
- [x] DB 마이그레이션 (flow_nodes + flow_edges)
- [x] sqlc 쿼리 작성
- [x] models.go (FlowNode, FlowEdge, FlowGraph)
- [x] validate.go (DAG 검증) + db_helpers.go
- [x] service.go (GetFlow, SaveFlow, CRUD, DAG 검증)
- [x] handler.go (REST 핸들러 8개)
- [x] 라우터 등록
- [x] 단위 테스트 (11 pass)

### PR-2: React Flow 캔버스 기초 ✅
- [x] @xyflow/react 설치
- [x] flowTypes.ts + flowApi.ts
- [x] useFlowData.ts
- [x] FlowCanvas.tsx
- [x] FlowToolbar.tsx
- [x] FlowSubTab 연동 (feature flag)
- [x] 기본 테스트 (8 pass)

**Wave 1 gate**: build + test pass, API 동작, 빈 캔버스 렌더링

---

## Wave 2 — 노드 시스템 (parallel)

### PR-3: Phase 커스텀 노드 ✅
- [x] StartNode.tsx
- [x] PhaseNode.tsx
- [x] PhaseNodePanel.tsx
- [x] NodeDetailPanel.tsx
- [x] 드래그 & 드롭
- [x] FlowCanvas 연결
- [x] 테스트 (13 new, 245 total pass)

### PR-4: Branch 노드 + 엣지 ✅
- [x] BranchNode.tsx
- [x] ConditionEdge.tsx
- [x] 연결 검증 유틸 (사이클 + 타입)
- [x] useFlowConnections.ts + flowNodeRegistry.ts
- [x] FlowCanvas 충돌 최소화 분리
- [x] 테스트 (21 new, 266 total pass)

**Wave 2 gate**: build + test pass, Phase/Branch 노드 동작

---

## Wave 3 — 엔딩 + 조건 (parallel)

### PR-5: Ending 노드 ✅
- [x] EndingNode.tsx
- [x] EndingNodePanel.tsx
- [x] NodeDetailPanel 확장 (ending 분기)
- [x] FlowCanvas 업데이트 (nodeTypes)
- [x] FlowToolbar (기존 옵션 확인)
- [x] tsc + 266 tests pass

### PR-6: 조건 규칙 빌더 ✅
- [x] conditionTypes.ts
- [x] ConditionRule.tsx
- [x] ConditionGroup.tsx
- [x] ConditionBuilder.tsx
- [x] useFlowConditionData.ts
- [x] BranchNodePanel + NodeDetailPanel branch 연동
- [x] 엣지 조건 편집
- [x] 테스트 (12 new, 278 total pass)

**Wave 3 gate**: build + test pass, 분기+엔딩+조건 동작

---

## Wave 4 — 통합 + QA (sequential)

### PR-7: 마이그레이션 + 통합 ✅
- [x] Go 마이그레이션 스크립트 (migration.go 67줄)
- [x] 마이그레이션 테스트 (4 tests)
- [x] FlowSubTab 전환 (179줄→9줄)
- [x] 기존 코드 정리 (PhaseTimeline/PhaseCard 삭제)
- [x] feature flag 제거
- [x] 통합 테스트 (275 pass)

### PR-8: 테스트 + QA ✅
- [x] Go handler 테스트 보강 (4 new)
- [x] Go DAG 검증 엣지 케이스 (4 new: self-loop, 고아, 100노드, ending-output)
- [x] EndingNode 테스트 (10 new)
- [x] ConditionBuilder 복합 테스트 (3 new)
- [x] useFlowData 변환 테스트 (14 new)
- [x] 전체: Go 23 tests + Frontend 303 tests (29 files)

**Wave 4 gate**: build + test pass, 전체 플로우 동작

---

## Phase completion gate

- [x] All 4 waves ✅
- [x] Root checklist "Phase 15.0 ✅"
- [ ] `project_phase150_progress.md` final
- [ ] `/plan-finish` executed
