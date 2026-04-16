# Phase 18.6 — E2E Recovery 실행 계획

> 부모: [design.md](design.md)

---

## Overview

W0 Playwright trace 수집 → W1 login 헬퍼 수정 + theme seed 병렬 → W2 회귀 + merge.

---

## Wave 구조

```
W0 (sequential):
  PR-1 — Playwright trace + artifact 조사 → 원인 확정

W1 (parallel ×2):
  PR-2 — Login 헬퍼 공용화 + 타임아웃 원인 수정    ← test-engineer
  PR-3 — Theme seed SQL + workflow step           ← go-backend

W2 (sequential):
  PR-4 — E2E green 검증 + PR 생성 + main 머지
```

---

## PR 목록

| PR | Wave | Title | 의존 | 도메인 |
|----|------|-------|------|--------|
| PR-1 | W0 | Investigate login timeout (trace + repro) | - | test |
| PR-2 | W1 | login helper 공용화 + fix | PR-1 | frontend/test |
| PR-3 | W1 | theme seed SQL + workflow step | - | backend/ci |
| PR-4 | W2 | Full regression + E2E green gate | PR-2,3 | test |

---

## Merge 전략

- W0 PR-1: 조사만 — worktree 불필요, 직접 main 기준 branch
- W1 PR-2/PR-3 worktree isolation (file 겹침 없음: apps/web/e2e/helpers vs .github/workflows + db/seed)
- 각 merge 후 CI `e2e-stubbed` 재실행, 이전 6 failures 중 최소 `방 생성` 1건 green 확인
- Wave 종료 시 user 확인 1회

---

## Feature flag

해당 없음 — 테스트 인프라만 수정.

---

## 알려진 위험

| 위험 | 완화 |
|------|------|
| Trace artifact 용량 제한 | `--trace=on-first-retry` 유지, 실패 1건만 분석 |
| theme seed SQL이 스키마 drift에 깨짐 | fixture seed 파일 버전화 + migrations 이후 실행 |
| login helper 변경이 editor-golden-path에 영향 | 단일 헬퍼로 통합 시 양쪽 테스트 모두 회귀 확인 |

---

## 테스트 전략

- PR-1: trace.zip artifact 다운로드 → Playwright viewer 로컬 분석. 증거 기반 원인 결정.
- PR-2: `vitest` 회귀 (editor 437 유지), Playwright local + CI 재실행
- PR-3: `psql` dry-run + server startup 이후 seed step 순서 검증
- PR-4: 3 E2E jobs 모두 green (방 생성·재접속·Redaction)
