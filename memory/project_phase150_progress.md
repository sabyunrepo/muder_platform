---
name: Phase 15.0 완료
description: React Flow 게임 흐름 에디터 — 8 PR, 4 Wave, Go 23 + Frontend 303 tests
type: project
---
Phase 15.0 — React Flow 게임 흐름 에디터 **완료** (2026-04-14)

## 결과
- 8 PRs, 4 Waves 전부 main 머지
- Go: 23 tests (flow 패키지), Frontend: 303 tests (29 files)
- feature flag 제거, PhaseTimeline→FlowCanvas 전환 완료

## 주요 산출물

### 백엔드 (Go)
- `apps/server/db/migrations/00021_flow_tables.sql`: flow_nodes + flow_edges 테이블
- `apps/server/internal/domain/flow/`: handler, service, models, validate, migration, db_helpers (7 파일)
- API: GET/PUT /themes/{id}/flow, CRUD nodes/edges, POST migrate

### 프론트엔드 (React)
- 커스텀 노드 4종: StartNode, PhaseNode, BranchNode, EndingNode
- 편집 패널: PhaseNodePanel, EndingNodePanel, BranchNodePanel, NodeDetailPanel
- 조건 빌더: ConditionBuilder, ConditionGroup, ConditionRule, conditionTypes
- 인프라: flowTypes, flowApi, useFlowData, useFlowConnections, connectionValidation, flowNodeRegistry
- FlowCanvas + FlowToolbar + FlowSubTab (9줄로 축소)

## 커밋 히스토리
| PR | 커밋 | 내용 |
|----|------|------|
| PR-1 | a58aa14 | DB 스키마 + Go API |
| PR-2 | 1412802 | React Flow 캔버스 기초 |
| PR-3 | 62b2d28 | Phase 커스텀 노드 |
| PR-4 | 0e8a6d4 | Branch 노드 + 엣지 |
| PR-5 | 2285d53 | Ending 노드 |
| PR-6 | 7317d7c | 조건 규칙 빌더 |
| PR-7 | 35cbbe0 | 마이그레이션 + 통합 |
| PR-8 | 2a46860 | 테스트 보강 |

## 후속
- Phase 16.0: 런타임 분기 평가 엔진 (게임 엔진 통합)
- Phase 16.x: AI 시나리오 자동 생성
