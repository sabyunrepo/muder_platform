# Phase 18.6 — E2E Recovery 체크리스트

> 부모: [design.md](design.md), [plan.md](plan.md)
> 시작: 2026-04-16

---

## W0 — PR-1: Investigate login timeout ✅ 완료 (2026-04-16)

- [x] Task 1 — run `24497907923` 로그 + artifact 다운로드
- [x] Task 2 — Start frontend step 로그 분석 (trace.zip 불요 — vite 에러가 로그에 명시)
- [x] Task 3 — 원인 확정: `@mmp/ws-client` workspace 미빌드 → Vite vite:dep-scan 실패 → SPA 부팅 실패
- [x] Task 4 — findings.md 작성 (H1~H4 기각, H5 확정, E1~E4 증거)

## W1 — PR-2: Login helper 공용화 (SKIPPED)

H5가 원인이었기에 placeholder/selector 수정 불필요. 순수 리팩터링은 가치 낮음으로 판정, 스킵.

- [~] Task 1~5 — skip

## W1 — PR-3: Workflow ws-client build fix (theme seed deferred)

- [x] Task 1 — `apps/server/db/seed/e2e-themes.sql` 신규 (미사용 상태로 보존)
- [~] Task 2 — Seed E2E theme step **비활성**: H6 ThemeCard crash 발견 후 workflow에서 제거
- [x] Task 3 — seed SQL idempotent (ON CONFLICT slug + IF NOT EXISTS characters)
- [x] Task 4 — **근본 원인 수정**: `Build workspace packages`에 `@mmp/ws-client` 추가 (findings.md H5)
- [x] Task 5 — 진단 artifact 추가: server.log + test-results/ 업로드 (H6 증거 수집 완료)

## W1 — PR-5 (H6): ThemeCard schema drift 수정

- [x] Task 1 — `apps/web/src/features/lobby/api.ts` ThemeSummary 필드 이름 서버 snake_case와 정렬 (min_players / max_players / duration_min / cover_image)
- [x] Task 2 — play_count / rating / difficulty optional 처리 + ThemeCard 방어 렌더
- [x] Task 3 — LobbyPage filter/sort, CreateRoomModal, RoomPage 필드 이름 치환
- [x] Task 4 — workflow `Seed E2E theme` step 재활성화
- [x] Task 5 — typecheck + vitest 104 files / 1017 tests green 로컬 검증

## W2 — PR-4: 회귀 + green gate

- [x] Task 1 — main에 PR #50 + #51 머지 후 `e2e-stubbed` 재실행
- [x] Task 2 — 3 E2E jobs (방 생성/재접속/Redaction) green (4 pass / 11 skip / 0 fail)
- [x] Task 3 — memory/project_phase186_progress.md 작성
- [x] Task 4 — MEMORY.md 인덱스 업데이트
- [ ] Task 5 — Issue #46 close (PR #46 merged — issue 별도 확인 필요)
- [ ] Task 6 — `/plan-finish` 실행

## 회귀/게이트

- [x] editor vitest 437+ 유지 (vitest 1017/1017 pass)
- [x] Go build + testcontainers 그린
- [x] CI 4/4 green (TS + Go + Docker + E2E)
