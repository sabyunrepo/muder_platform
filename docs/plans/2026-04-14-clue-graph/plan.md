# Phase 17.5 — 단서 관계 그래프 실행 계획 (index)

> 부모: [design.md](design.md)
> MD 200줄 제한: 각 PR 상세는 `refs/pr-N-*.md`

---

## Overview

백엔드 clue graph primitive(Phase 9.0)를 API로 노출하고,
에디터에서 단서 간 의존 관계를 ReactFlow DAG로 시각화/편집한다.

---

## Wave 구조

```
Wave 1 (sequential): PR-1 백엔드 API
  ↓
Wave 2 (parallel): PR-2 프론트 그래프, PR-3 검증 연동
  ↓
Wave 3 (sequential): PR-4 통합 테스트
```

| Wave | Mode | PRs | 의존 | 예상 |
|------|------|-----|------|------|
| W1 | sequential | PR-1 | - | 중 |
| W2 | parallel | PR-2, PR-3 | W1 | 중 |
| W3 | sequential | PR-4 | W2 | 소 |

---

## PR 목록

| PR | Wave | Title | 의존 | Scope | Tasks | 상세 |
|----|------|-------|------|-------|-------|------|
| PR-1 | W1 | 단서 관계 API | - | handler, service, sqlc | 4 | [refs/pr-1-api.md](refs/pr-1-api.md) |
| PR-2 | W2 | ClueRelationGraph 컴포넌트 | PR-1 | ReactFlow, hooks | 4 | [refs/pr-2-graph-ui.md](refs/pr-2-graph-ui.md) |
| PR-3 | W2 | 검증 연동 | PR-1 | validation, ValidationPanel | 3 | [refs/pr-3-validation.md](refs/pr-3-validation.md) |
| PR-4 | W3 | 통합 + E2E | PR-2,3 | e2e, 폴리시 | 3 | [refs/pr-4-integration.md](refs/pr-4-integration.md) |

---

## Merge 전략

- Wave 내 병렬 PR은 `isolation: worktree`
- 머지는 PR 번호 순 sequential
- 각 머지 후 `pnpm test` + `go test` gate
- Wave 종료 시 user 확인 1회

---

## 알려진 위험

| 위험 | 완화 |
|------|------|
| DB 마이그레이션 (clue_relations 테이블) | sqlc + migrate 파일 분리 |
| ReactFlow 두 번째 인스턴스 (FlowCanvas와 별도) | 동일 패턴 재사용 |
| cycle 감지 UX | 즉시 에러 표시 + 엣지 추가 차단 |

---

## 후속

- **Phase 18.0**: 게임 런타임 통합 (엔진+모듈+WS)
