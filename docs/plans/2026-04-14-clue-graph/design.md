# Phase 17.5 — 단서 관계 그래프 설계 (index)

> **상태**: 확정
> **시작**: 2026-04-14
> **다음 단계**: plan.md → wave 기반 실행
> **MD 200줄 제한**: 모든 문서 <200줄. 상세는 `refs/` 분할.

---

## 목적

에디터에서 단서 간 의존 관계(전제 조건)를 시각적으로 편집하고,
게임 런타임의 `internal/clue/graph.go` DAG와 연동한다.
백엔드 clue graph primitive는 Phase 9.0에서 이미 구현됨 — API 노출 + 프론트 시각화가 핵심.

---

## Scope

| 카테고리 | 항목 |
|---------|------|
| Backend API | 단서 관계 CRUD (GET/PUT /themes/:id/clue-relations) |
| Frontend | ClueRelationGraph (ReactFlow 기반 DAG 시각화) |
| Editor 통합 | 단서 탭에 "관계" 서브탭 추가 |
| 검증 | graph validator 결과 → ValidationPanel 연동 |

**Out of scope**: 런타임 단서 해금 로직(Phase 18.0), visibility 룰 에디터(후속)

상세는 [refs/scope-and-decisions.md](refs/scope-and-decisions.md).

---

## 7대 결정 (변경 금지)

| # | 결정 | 선택 | 근거 |
|---|------|------|------|
| 1 | Scope | API 1개 + 프론트 3컴포넌트 | 백엔드 graph 이미 있음 |
| 2 | Architecture | ReactFlow 재사용 (FlowCanvas 패턴) | Phase 15~17 검증됨 |
| 3 | Lifecycle | ClueRelation은 테마 종속 | 단서 삭제 시 cascade |
| 4 | External Interface | GET/PUT /clue-relations | config_json이 아닌 별도 API |
| 5 | Persistence | clue_relations 테이블 (source_id, target_id, mode) | JSONB 아닌 정규 테이블 |
| 6 | 운영 안전성 | Go test + Vitest + Playwright | 기존 테스트 보강 |
| 7 | 도입 전략 | 직접 적용 (flag 불필요) | 에디터 내부 기능 |

---

## 문서 맵 (refs/)

| 파일 | 내용 |
|------|------|
| [refs/scope-and-decisions.md](refs/scope-and-decisions.md) | 상세 결정 + 수정 방안 |
| [refs/execution-model.md](refs/execution-model.md) | Wave DAG + 파일 스코프 |

---

## 실행 전략 요약

| Wave | PRs | 모드 | 의존 |
|------|-----|------|------|
| W1 | PR-1 | sequential | - |
| W2 | PR-2, PR-3 | parallel | W1 |
| W3 | PR-4 | sequential | W2 |

**속도 이득**: 순차 4T → 병렬 3T (~25% 단축)

---

## 종료 조건

- [ ] 모든 PR main 머지 (3 waves 완료)
- [ ] 단서 관계 API 동작 (GET/PUT)
- [ ] ReactFlow 그래프에서 단서 노드 + 의존 엣지 표시
- [ ] 관계 추가/삭제 → 서버 저장
- [ ] cycle 감지 → 에러 표시
- [ ] validator 결과 → ValidationPanel 연동
- [ ] Vitest + Go 테스트 통과
