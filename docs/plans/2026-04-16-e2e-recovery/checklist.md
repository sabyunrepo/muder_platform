# Phase 18.6 — E2E Recovery 체크리스트

> 부모: [design.md](design.md), [plan.md](plan.md)
> 시작: 2026-04-16

---

## W0 — PR-1: Investigate login timeout ✅ 완료 (2026-04-16)

- [x] Task 1 — run `24497907923` 로그 + artifact 다운로드
- [x] Task 2 — Start frontend step 로그 분석 (trace.zip 불요 — vite 에러가 로그에 명시)
- [x] Task 3 — 원인 확정: `@mmp/ws-client` workspace 미빌드 → Vite vite:dep-scan 실패 → SPA 부팅 실패
- [x] Task 4 — findings.md 작성 (H1~H4 기각, H5 확정, E1~E4 증거)

## W1 — PR-2: Login helper 공용화 + 수정

- [ ] Task 1 — `apps/web/e2e/helpers/auth.ts` 신규 — `loginWithForm(page, email, password)` export
- [ ] Task 2 — game-session/reconnect/redaction 3파일이 새 헬퍼 import 하도록 치환
- [ ] Task 3 — PR-1 원인 반영: placeholder/selector/waitFor 수정
- [ ] Task 4 — Vitest + lint 그린 유지
- [ ] Task 5 — 변경 파일 ≤400줄 / 함수 ≤60줄 확인

## W1 — PR-3: Workflow build fix + Theme seed

- [x] Task 1 — `apps/server/db/seed/e2e-themes.sql` 신규 (published theme + 4 characters)
- [x] Task 2 — `.github/workflows/e2e-stubbed.yml` 에 `Seed E2E theme` step 추가
- [x] Task 3 — seed SQL idempotent (ON CONFLICT slug + IF NOT EXISTS characters)
- [x] Task 4 — **근본 원인 수정**: `Build workspace packages`에 `@mmp/ws-client` 추가 (findings.md H5)

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
