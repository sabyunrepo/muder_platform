# Phase 11.0 — 메타포 테스트 게임 실행 계획

> STATUS: DRAFT

## Wave 구조

```
Wave 1: [PR-1] 단서 아이템 시스템 (DB + 백엔드)
           │
     ┌─────┴─────┐
     ▼           ▼
Wave 2: [PR-2] [PR-3]  (에디터 UI / 게임 UI — 병렬)
     │           │
     └─────┬─────┘
           ▼
Wave 3: [PR-4] 메타포 템플릿 + 테마 시드
           │
           ▼
Wave 4: [PR-5] E2E 테스트
```

## PR 목록

| PR | Wave | 제목 | 의존 | scope_globs |
|----|------|------|------|-------------|
| PR-1 | 1 | 단서 아이템 시스템 | - | `apps/server/db/**`, `apps/server/internal/module/core/clue_interaction.go`, `apps/server/internal/db/**` |
| PR-2 | 2 | 에디터 아이템 설정 UI | PR-1 | `apps/web/src/features/editor/**` |
| PR-3 | 2 | 게임 UI 아이템 사용 | PR-1 | `apps/web/src/features/game/**` |
| PR-4 | 3 | 메타포 템플릿 + 시드 | PR-1,2 | `apps/server/internal/template/**`, `apps/server/db/seed/**` |
| PR-5 | 4 | E2E 테스트 | PR-1~4 | `apps/web/e2e/**`, `apps/server/**_test.go` |

## 상세 스펙
- [refs/prs/pr-1.md](refs/prs/pr-1.md) — 단서 아이템 시스템
- [refs/prs/pr-2.md](refs/prs/pr-2.md) — 에디터 UI
- [refs/prs/pr-3.md](refs/prs/pr-3.md) — 게임 UI
- [refs/prs/pr-4.md](refs/prs/pr-4.md) — 메타포 템플릿
- [refs/prs/pr-5.md](refs/prs/pr-5.md) — E2E 테스트
