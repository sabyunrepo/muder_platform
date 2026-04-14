# Phase 15.0 — Wave DAG + PR 의존

---

## Wave 구조

```
Wave 1 (parallel): PR-1 DB+API, PR-2 React Flow 기본 캔버스
     ↓
Wave 2 (parallel): PR-3 Phase노드, PR-4 Branch노드+엣지
     ↓
Wave 3 (parallel): PR-5 Ending노드, PR-6 규칙빌더
     ↓
Wave 4 (sequential): PR-7 마이그레이션+통합, PR-8 테스트+QA
```

---

## PR 의존 그래프

```
PR-1 ──┬── PR-3 ──┬── PR-5 ──┬── PR-7 ── PR-8
PR-2 ──┘   PR-4 ──┘   PR-6 ──┘
```

- PR-1 (DB+API): 독립
- PR-2 (캔버스 기초): 독립
- PR-3 (Phase노드): PR-1 (API) + PR-2 (캔버스) 필요
- PR-4 (Branch+엣지): PR-1 (API) + PR-2 (캔버스) 필요
- PR-5 (Ending): PR-3, PR-4 (노드 시스템 완성) 필요
- PR-6 (조건빌더): PR-4 (Branch 노드) 필요
- PR-7 (마이그레이션): PR-5, PR-6 (전체 기능) 필요
- PR-8 (테스트): PR-7 (통합 완료) 필요

---

## 머지 전략

- Wave 내 병렬 PR은 `isolation: worktree`
- 머지는 항상 PR 번호 순 sequential
- 각 머지 후 `pnpm build && pnpm test && go test ./...` gate
- Wave 종료 시 user 확인 1회

---

## Feature flag 전략

| Wave | flag 상태 | 이유 |
|------|----------|------|
| W1 | off | API만 존재, UI 미연결 |
| W2 | off | 캔버스 개발 중, 불완전 |
| W3 | off | 엔딩+조건 완성 필요 |
| W4-PR7 | on | 마이그레이션 후 전환 |

flag: `flow_canvas_enabled` in config / env
