<!-- STATUS: {"phase":"15.0","wave":"W3","pr":"PR-5","task":"EndingNode.tsx","state":"in_progress"} -->
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

### PR-5: Ending 노드
- [ ] EndingNode.tsx
- [ ] EndingNodePanel.tsx
- [ ] NodeDetailPanel 확장
- [ ] FlowCanvas 업데이트
- [ ] FlowToolbar 업데이트
- [ ] 테스트

### PR-6: 조건 규칙 빌더
- [ ] conditionTypes.ts
- [ ] ConditionRule.tsx
- [ ] ConditionGroup.tsx
- [ ] ConditionBuilder.tsx
- [ ] useFlowConditionData.ts
- [ ] NodeDetailPanel branch 연동
- [ ] 엣지 조건 편집
- [ ] 테스트

**Wave 3 gate**: build + test pass, 분기+엔딩+조건 동작

---

## Wave 4 — 통합 + QA (sequential)

### PR-7: 마이그레이션 + 통합
- [ ] Go 마이그레이션 스크립트
- [ ] 마이그레이션 테스트
- [ ] FlowSubTab 전환
- [ ] 기존 코드 정리
- [ ] feature flag 제거
- [ ] 통합 테스트

### PR-8: 테스트 + QA
- [ ] Go 통합 테스트
- [ ] Go DAG 검증 엣지 케이스
- [ ] 프론트 컴포넌트 테스트 보강
- [ ] ConditionBuilder 복합 테스트
- [ ] 수동 QA

**Wave 4 gate**: build + test pass, 전체 플로우 동작

---

## Phase completion gate

- [ ] All 4 waves ✅
- [ ] Root checklist "Phase 15.0 ✅"
- [ ] `project_phase150_progress.md` final
- [ ] `/plan-finish` executed
