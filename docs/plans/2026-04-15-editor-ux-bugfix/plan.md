# Phase 18.4 — 에디터 UX Bugfix 실행 계획

> 부모: [design.md](design.md)

---

## Overview

W0 백엔드 라우트/쿼리 정상화(2병렬) → W1 프론트 네트워크/캐시(2병렬) → W2 UX 개선(2병렬) → W3 풀 회귀.

---

## Wave 구조

```
W0 (parallel ×2):
  PR-1 — Backend route fixes (templates GET, flow PATCH 정리)      ← backend
  PR-2 — clue-relations 빈 결과 + config 409 current_version       ← backend
  ↓
W1 (parallel ×2):
  PR-3 — upload-url 경로 + clue 이미지 캐시 동기화                 ← frontend
  PR-4 — config 409 rebase + 모듈 토글 Snackbar                    ← frontend
  ↓
W2 (parallel ×2):
  PR-5 — Optimistic update + debounce 1500ms + onBlur flush        ← frontend
  PR-6 — Location clue placement panel + config_json.locations[]   ← frontend
  ↓
W3 (sequential):
  PR-7 — E2E 골든패스 9 시나리오 + 회귀 + 문서 + plan-finish 준비
```

---

## PR 목록

| PR | Wave | Title | 의존 | 도메인 |
|----|------|-------|------|--------|
| PR-1 | W0 | Backend: templates route 등록 + flow PATCH 정리 | - | backend |
| PR-2 | W0 | Backend: clue-relations empty + config 409 current_version | - | backend |
| PR-3 | W1 | Frontend: upload-url path + clue image setQueryData | PR-1 | frontend |
| PR-4 | W1 | Frontend: config 409 rebase + 1회 retry + Snackbar | PR-2 | frontend |
| PR-5 | W2 | Frontend: optimistic update + debounce 1500ms + onBlur | PR-4 | frontend |
| PR-6 | W2 | Frontend: LocationClueAssignPanel + schema 확장 | PR-4 | frontend |
| PR-7 | W3 | E2E + regression + docs + memory update | PR-5,6 | test/docs |

---

## Merge 전략

- W0 PR-1/PR-2 worktree isolation — 파일 겹침 없음 (main.go vs handler/service)
- W1 PR-3/PR-4 worktree — PR-3 imageApi/ClueForm, PR-4 editorConfigApi/ModulesSubTab
- W2 PR-5/PR-6 worktree — PR-5 CharacterAssignPanel/PhaseNodePanel, PR-6 LocationsSubTab 신규 컴포넌트
- 각 머지 후 gate: `go test -race ./internal/domain/editor/...` + `pnpm test` + `pnpm build`
- Wave 종료 시 user 확인 1회

---

## Feature flag

해당 없음 — 버그픽스 + UX 개선, 기능 추가 아님 (PR-6 배치 UI는 기존 tab 확장, 토글 불필요).

---

## 알려진 위험

| 위험 | 완화 |
|------|------|
| PR-2 409 response schema 변경이 기존 클라이언트 호환성 깰 수 있음 | `current_version` 은 optional extension — 기존 클라이언트는 무시 |
| PR-5 optimistic update rollback 로직 오류 시 UI 상태 깨짐 | `editorClueApi.ts` 패턴 그대로 복사, 단위 테스트 추가 |
| PR-6 `locations[].clueIds` 스키마 — 런타임 엔진 미사용 | mini-spec 문서화, 런타임 연동은 Phase 18.5 후보로 명시 |
| PR-3 themeId 레이스 | `ImageCropUpload` props로 themeId 강제 주입, undefined 시 버튼 disabled |

---

## 테스트 전략

- PR-1/2: Go table-driven 테스트 + httptest 핸들러 스모크 (신규 테마 빈 결과, version mismatch)
- PR-3/4: Vitest + MSW (409 응답 mock, 이미지 upload flow mock)
- PR-5: Vitest — onMutate/onError rollback, debounce timer fake
- PR-6: Vitest — 체크박스 optimistic toggle
- PR-7: Playwright 9 시나리오 (stubbed backend CI job 활용)

---

## 수락 기준

- 9개 증상 전부 해결 확인 (수동 골든패스)
- 타이핑 중 네트워크 탭 `PUT /config` 1.5s 후 1회만
- 전체 `go test -race` + `pnpm test` + E2E green
- 문서: memory/project_phase184_progress.md + MEMORY.md 링크 추가
