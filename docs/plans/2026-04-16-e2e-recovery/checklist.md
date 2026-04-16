# Phase 18.6 — E2E Recovery 체크리스트

> 부모: [design.md](design.md), [plan.md](plan.md)
> 시작: 2026-04-16

---

## W0 — PR-1: Investigate login timeout

- [ ] Task 1 — PR #48 머지 후 trigger된 latest `e2e-stubbed` run 아티팩트 다운로드
- [ ] Task 2 — `playwright-e2e-stubbed-report/` trace 로컬 뷰어로 분석
- [ ] Task 3 — fill 실패 원인 확정 (placeholder 텍스트, 리다이렉트, hydration, 네트워크 등)
- [ ] Task 4 — findings.md 에 증거(스크린샷/네트워크 타임라인) 정리

## W1 — PR-2: Login helper 공용화 + 수정

- [ ] Task 1 — `apps/web/e2e/helpers/auth.ts` 신규 — `loginWithForm(page, email, password)` export
- [ ] Task 2 — game-session/reconnect/redaction 3파일이 새 헬퍼 import 하도록 치환
- [ ] Task 3 — PR-1 원인 반영: placeholder/selector/waitFor 수정
- [ ] Task 4 — Vitest + lint 그린 유지
- [ ] Task 5 — 변경 파일 ≤400줄 / 함수 ≤60줄 확인

## W1 — PR-3: Theme seed SQL + workflow step

- [ ] Task 1 — `apps/server/db/seed/e2e-themes.sql` 신규 (published theme 1건 + characters/clues 최소 fixture)
- [ ] Task 2 — `.github/workflows/e2e-stubbed.yml` 에 `Seed E2E theme` step 추가 (Seed user 다음, Start server 전)
- [ ] Task 3 — seed SQL idempotent 확인 (ON CONFLICT, 재실행 안전)
- [ ] Task 4 — `go build ./...` 그린 (관련 파일 없지만 회귀 체크)

## W2 — PR-4: 회귀 + green gate

- [ ] Task 1 — main에 PR-2, PR-3 머지 후 `e2e-stubbed` 재실행
- [ ] Task 2 — 3 E2E jobs (방 생성/재접속/Redaction) 전부 green 확인
- [ ] Task 3 — memory/project_phase186_progress.md 작성
- [ ] Task 4 — MEMORY.md 인덱스 업데이트
- [ ] Task 5 — Issue #46 close
- [ ] Task 6 — `/plan-finish` 실행

## 회귀/게이트

- [ ] editor vitest 437+ 유지
- [ ] Go build + testcontainers 그린
- [ ] CI 4/4 green (TS + Go + Docker + E2E)
