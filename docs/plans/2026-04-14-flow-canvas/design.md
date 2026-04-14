# Phase 15.0 — React Flow 게임 흐름 에디터 (index)

> **상태**: 확정
> **시작**: 2026-04-14
> **다음 단계**: plan.md → wave 기반 실행
> **상위 참조**: docs/plans/2026-04-05-rebuild/design.md
> **MD 200줄 제한**: 모든 문서 <200줄. 상세는 `refs/` 분할.

---

## 목적

에디터 게임설계 > 흐름 서브탭의 선형 PhaseTimeline을
React Flow 기반 시각적 캔버스 에디터로 교체한다.
분기 흐름(조건부 경로) + 복수 엔딩 지원으로
머더미스터리 게임의 비선형 시나리오를 설계할 수 있게 한다.

---

## Scope

| 카테고리 | 항목 |
|---------|------|
| 백엔드 | flow_nodes + flow_edges 테이블, CRUD API |
| 프론트 | React Flow 캔버스, 커스텀 노드 4종, 커스텀 엣지 |
| 분기 | Branch 노드 + 조건 규칙 빌더 (AND/OR 그룹) |
| 엔딩 | Ending 노드 + 엔딩 설정 패널 |
| 마이그레이션 | config_json.phases → flow_nodes/edges 자동 변환 |
| 테스트 | Go 단위 + 프론트 컴포넌트 + 플로우 CRUD E2E |

**Out of scope**: 런타임 분기 평가 엔진 (게임 엔진 Phase 16+), AI 시나리오 생성

상세는 [refs/scope-and-decisions.md](refs/scope-and-decisions.md).

---

## 7대 결정

| # | 결정 | 선택 | 근거 |
|---|------|------|------|
| 1 | Scope | C안 (풀 엔딩 에디터) | 캔버스+분기+엔딩+조건+마이그레이션 |
| 2 | Architecture | @xyflow/react v12 + Go API | 프론트 캔버스 + 백엔드 그래프 저장 |
| 3 | Lifecycle | flow_nodes/edges CRUD | 노드 생성/수정/삭제/위치이동 |
| 4 | External Interface | REST API 신규 | `/themes/{id}/flow/*` 엔드포인트 |
| 5 | Persistence | DB 확장 (flow_nodes, flow_edges) | config_json 대신 정규 테이블 |
| 6 | 운영 안전성 | 마이그레이션 + 테스트 | 기존 데이터 자동 변환 + 롤백 가능 |
| 7 | 도입 전략 | 4 Wave, feature flag off→on | 마이그레이션 완료 전까지 보호 |

---

## 문서 맵 (refs/)

| 파일 | 내용 |
|------|------|
| [refs/scope-and-decisions.md](refs/scope-and-decisions.md) | 7대 결정 상세 |
| [refs/architecture.md](refs/architecture.md) | 노드/엣지/조건 데이터 모델 |
| [refs/execution-model.md](refs/execution-model.md) | Wave DAG + PR 의존 |
| [refs/pr-1-db-api.md](refs/pr-1-db-api.md) | PR-1 상세 |
| [refs/pr-2-canvas-base.md](refs/pr-2-canvas-base.md) | PR-2 상세 |
| [refs/pr-3-phase-node.md](refs/pr-3-phase-node.md) | PR-3 상세 |
| [refs/pr-4-branch-edge.md](refs/pr-4-branch-edge.md) | PR-4 상세 |
| [refs/pr-5-ending-node.md](refs/pr-5-ending-node.md) | PR-5 상세 |
| [refs/pr-6-condition-builder.md](refs/pr-6-condition-builder.md) | PR-6 상세 |
| [refs/pr-7-migration.md](refs/pr-7-migration.md) | PR-7 상세 |
| [refs/pr-8-test-qa.md](refs/pr-8-test-qa.md) | PR-8 상세 |

---

## 실행 전략 요약

| Wave | PRs | 모드 | 의존 |
|------|-----|------|------|
| W1 | PR-1, PR-2 | parallel | - |
| W2 | PR-3, PR-4 | parallel | W1 |
| W3 | PR-5, PR-6 | parallel | W2 |
| W4 | PR-7, PR-8 | sequential | W3 |

**속도 이득**: 순차 8T → 병렬 4T (~50% 단축)

---

## 종료 조건

- [ ] 8 PR main 머지 (4 waves 완료)
- [ ] pnpm build 성공
- [ ] pnpm test + go test 통과
- [ ] React Flow 캔버스에서 분기 흐름 생성 가능
- [ ] 기존 선형 데이터 자동 마이그레이션 확인
- [ ] `project_phase150_progress.md` 최종 갱신
