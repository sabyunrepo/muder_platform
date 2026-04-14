<!-- STATUS: {"phase":"15.0","wave":"W1","pr":"","task":"","state":"pending"} -->
# Phase 15.0 — React Flow 게임 흐름 에디터 체크리스트

> 부모: [design.md](design.md) | 실행: [plan.md](plan.md)

---

## Wave 1 — DB + 캔버스 기초 (parallel)

### PR-1: DB 스키마 + Go API
- [ ] DB 마이그레이션 (flow_nodes + flow_edges)
- [ ] sqlc 쿼리 작성
- [ ] models.go (FlowNode, FlowEdge, FlowGraph)
- [ ] repository.go
- [ ] service.go (GetFlow, SaveFlow, CRUD, DAG 검증)
- [ ] handler.go (REST 핸들러 8개)
- [ ] 라우터 등록
- [ ] 단위 테스트

### PR-2: React Flow 캔버스 기초
- [ ] @xyflow/react 설치
- [ ] flowApi.ts
- [ ] useFlowData.ts
- [ ] FlowCanvas.tsx
- [ ] FlowToolbar.tsx
- [ ] FlowSubTab 연동 (feature flag)
- [ ] 기본 테스트

**Wave 1 gate**: build + test pass, API 동작, 빈 캔버스 렌더링

---

## Wave 2 — 노드 시스템 (parallel)

### PR-3: Phase 커스텀 노드
- [ ] StartNode.tsx
- [ ] PhaseNode.tsx
- [ ] PhaseNodePanel.tsx
- [ ] NodeDetailPanel.tsx
- [ ] 드래그 & 드롭
- [ ] FlowCanvas 연결
- [ ] 테스트

### PR-4: Branch 노드 + 엣지
- [ ] BranchNode.tsx
- [ ] ConditionEdge.tsx
- [ ] 연결 검증 유틸 (사이클 + 타입)
- [ ] onConnect / onEdgesChange API 연동
- [ ] FlowCanvas 업데이트
- [ ] 테스트

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
