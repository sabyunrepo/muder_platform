# Phase 15.0 — React Flow 게임 흐름 에디터 (plan)

> 부모: [design.md](design.md)
> MD 200줄 제한: 각 PR 상세는 `refs/pr-N-*.md`

---

## Overview

에디터 게임설계 > 흐름 서브탭을 React Flow 캔버스로 교체.
분기 흐름 + 복수 엔딩 + 조건 규칙 빌더 + DB 확장 + 마이그레이션.

---

## Wave 구조

```
Wave 1 (parallel): PR-1 DB+API, PR-2 캔버스 기초
  ↓
Wave 2 (parallel): PR-3 Phase노드, PR-4 Branch+엣지
  ↓
Wave 3 (parallel): PR-5 Ending, PR-6 조건빌더
  ↓
Wave 4 (sequential): PR-7 마이그레이션, PR-8 테스트
```

| Wave | Mode | PRs | 의존 | 예상 |
|------|------|-----|------|------|
| W1 | parallel | PR-1, PR-2 | - | 1.5T |
| W2 | parallel | PR-3, PR-4 | W1 | 1.5T |
| W3 | parallel | PR-5, PR-6 | W2 | 1.5T |
| W4 | sequential | PR-7, PR-8 | W3 | 1T |

---

## PR 목록

| PR | Wave | Title | 의존 | Tasks | 상세 |
|----|------|-------|------|-------|------|
| PR-1 | W1 | DB 스키마 + Go API | - | 8 | [refs/pr-1-db-api.md](refs/pr-1-db-api.md) |
| PR-2 | W1 | React Flow 캔버스 기초 | - | 7 | [refs/pr-2-canvas-base.md](refs/pr-2-canvas-base.md) |
| PR-3 | W2 | Phase 커스텀 노드 | W1 | 7 | [refs/pr-3-phase-node.md](refs/pr-3-phase-node.md) |
| PR-4 | W2 | Branch 노드 + 엣지 | W1 | 6 | [refs/pr-4-branch-edge.md](refs/pr-4-branch-edge.md) |
| PR-5 | W3 | Ending 노드 | W2 | 6 | [refs/pr-5-ending-node.md](refs/pr-5-ending-node.md) |
| PR-6 | W3 | 조건 규칙 빌더 | PR-4 | 8 | [refs/pr-6-condition-builder.md](refs/pr-6-condition-builder.md) |
| PR-7 | W4 | 마이그레이션 + 통합 | W3 | 6 | [refs/pr-7-migration.md](refs/pr-7-migration.md) |
| PR-8 | W4 | 테스트 + QA | PR-7 | 5 | [refs/pr-8-test-qa.md](refs/pr-8-test-qa.md) |

---

## Merge 전략

- Wave 내 병렬 PR은 `isolation: worktree`
- 머지는 PR 번호 순 sequential
- 각 머지 후 `pnpm build && pnpm test && go test ./...`
- Wave 종료 시 user 확인 1회
- Feature flag: W1-W3 off → W4-PR7에서 on

---

## 알려진 위험

| 위험 | 완화 |
|------|------|
| React Flow 번들 크기 | tree-shaking + lazy import |
| DAG 순환 | Go service 레이어에서 DFS 검증 |
| 마이그레이션 데이터 손실 | up/down 마이그레이션 + 테스트 |
| 조건 빌더 UX 복잡도 | 변수 select 우선, 커스텀은 고급 |

---

## 후속 phase

- **Phase 16.0**: 런타임 분기 평가 엔진 (게임 엔진 통합)
- **Phase 16.x**: AI 시나리오 자동 생성
