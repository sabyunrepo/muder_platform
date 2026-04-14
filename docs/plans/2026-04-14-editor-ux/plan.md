# Phase 14.0 — 에디터 UX 개선 + 버그 수정 (plan)

> 부모: [design.md](design.md)
> MD 200줄 제한: 각 PR 상세는 `refs/pr-N-*.md`

---

## Overview

Phase 13.0 이후 발견된 에디터 UX 퇴보/버그 5건 수정.
이미지 업로드 fix, 반응형, 히든미션/단서 UX, 탭 구조 재편.

---

## Wave 구조

```
Wave 1 (parallel): PR-1 이미지fix, PR-2 반응형
  ↓
Wave 2 (parallel): PR-3 미션+단서, PR-4 모듈통합
  ↓
Wave 3 (sequential): PR-5 탭구조재편
```

| Wave | Mode | PRs | 의존 | 예상 |
|------|------|-----|------|------|
| W1 | parallel | PR-1, PR-2 | - | 1T |
| W2 | parallel | PR-3, PR-4 | W1 | 1T |
| W3 | sequential | PR-5 | W2 | 1T |

---

## PR 목록

| PR | Wave | Title | 의존 | Tasks | 상세 |
|----|------|-------|------|-------|------|
| PR-1 | W1 | 이미지 업로드 400 fix | - | 4 | [refs/pr-1-image-fix.md](refs/pr-1-image-fix.md) |
| PR-2 | W1 | 에디터 반응형 대응 | - | 4 | [refs/pr-2-responsive.md](refs/pr-2-responsive.md) |
| PR-3 | W2 | 히든미션 + 단서 compact | W1 | 7 | [refs/pr-3-mission-clue-ux.md](refs/pr-3-mission-clue-ux.md) |
| PR-4 | W2 | 모듈+설정 통합 | W1 | 4 | [refs/pr-4-module-settings.md](refs/pr-4-module-settings.md) |
| PR-5 | W3 | 게임설계 탭 구조 재편 | PR-3,PR-4 | 5 | [refs/pr-5-tab-restructure.md](refs/pr-5-tab-restructure.md) |

---

## Merge 전략

- Wave 내 병렬 PR은 `isolation: worktree`
- 머지는 항상 PR 번호 순 sequential
- 각 머지 후 `pnpm build && pnpm test` gate
- Wave 종료 시 user 확인 1회
- 충돌 발생 시 executor 서브에이전트에 해결 위임

---

## Feature flag

- 불필요 — UI 리팩터링이므로 즉시 반영
- 기존 기능 제거 없음 (이동/통합만)

---

## 알려진 위험

| 위험 | 완화 |
|------|------|
| PR-3 + PR-5 파일 충돌 (CharacterAssignPanel) | PR-3 먼저 머지, PR-5는 W3에서 최신 기반 |
| WebP 브라우저 미지원 | canvas.toBlob WebP 실패 시 JPEG 폴백 |
| 모듈 통합 후 ConfigSchema 렌더링 깨짐 | SchemaDrivenForm 기존 테스트로 커버 |

---

## 후속 phase

- **Phase 15.0**: 흐름 탭 React Flow 캔버스 도입
- **Phase 15.x**: 엔딩 분기 에디터, 미디어 탭 리디자인
