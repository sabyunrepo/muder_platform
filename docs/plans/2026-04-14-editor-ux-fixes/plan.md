# Phase 16.0 — 에디터 UX 버그픽스 + 개선 실행 계획 (index)

> 부모: [design.md](design.md)
> MD 200줄 제한: 각 PR 상세는 `refs/pr-N-*.md`

---

## Overview

Phase 15.0 QA 후 발견된 에디터 UX 이슈 4건 수정.
버그 1건 + UX 개선 3건, 프론트엔드 전용 (백엔드 변경 없음).

---

## Wave 구조

```
Wave 1 (parallel): PR-1 단서이미지, PR-2 모달스크롤
  ↓
Wave 2 (parallel): PR-3 모듈탭, PR-4 흐름템플릿
```

| Wave | Mode | PRs | 의존 | 예상 |
|------|------|-----|------|------|
| W1 | parallel | PR-1, PR-2 | - | 소 |
| W2 | parallel | PR-3, PR-4 | W1 | 중 |

---

## PR 목록

| PR | Wave | Title | 의존 | Scope | Tasks | 상세 |
|----|------|-------|------|-------|-------|------|
| PR-1 | W1 | 단서 이미지 캐시 무효화 | - | imageApi.ts | 2 | [refs/pr-1-clue-image.md](refs/pr-1-clue-image.md) |
| PR-2 | W1 | Modal 스크롤 + 버튼 고정 | - | Modal.tsx, ClueForm.tsx | 3 | [refs/pr-2-modal-scroll.md](refs/pr-2-modal-scroll.md) |
| PR-3 | W2 | 모듈 탭 v2 토글 리디자인 | PR-1,2 | ModulesSubTab.tsx, constants.ts | 4 | [refs/pr-3-module-toggle.md](refs/pr-3-module-toggle.md) |
| PR-4 | W2 | 흐름 기본 템플릿 | PR-1,2 | useFlowData.ts | 3 | [refs/pr-4-flow-template.md](refs/pr-4-flow-template.md) |

---

## Merge 전략

- Wave 내 병렬 PR은 `isolation: worktree`
- 머지는 PR 번호 순 sequential
- 각 머지 후 `pnpm test` gate
- Wave 종료 시 user 확인 1회

---

## Feature flag

없음. 버그픽스 + UI 개선이라 feature flag 불필요.

---

## 알려진 위험

| 위험 | 완화 |
|------|------|
| Modal 변경이 다른 모달에 영향 | 기존 모달 UI 전수 확인 |
| 흐름 기본 템플릿이 기존 테마에 영향 | 빈 flow일 때만 적용 (조건부) |

---

## 후속

- **Phase 16.x**: 에디터 고급 기능 (모듈 설정 UX, 흐름 검증 강화)
- **Phase 17.0**: 게임 런타임 통합
