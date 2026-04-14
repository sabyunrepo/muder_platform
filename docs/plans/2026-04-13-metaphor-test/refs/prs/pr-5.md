# PR-5 — E2E 테스트

**Wave**: 4 · **Parallel**: ×1 · **Depends on**: PR-1~4 · **Branch**: `feat/metaphor-e2e`

## Context
메타포 게임 전체 플로우 E2E 검증. 세션 생성 → 캐릭터 선택 → 조사 → 토의 → 투표 → 엔딩.

## Tasks

### T1: Go 통합 테스트
- [ ] `internal/session/metaphor_test.go` — 6 플레이어 시뮬레이션
- [ ] 전체 13 페이즈 순차 진행
- [ ] 단서 획득 (4장 제한)
- [ ] 아이템 사용 (peek)
- [ ] 투표 → 최다 득표자 구속
- [ ] 히든 미션 점수 계산

### T2: Playwright E2E (선택)
- [ ] 브라우저에서 에디터 → 게임 시작 → 기본 흐름 검증

## scope_globs
- `apps/server/internal/session/metaphor_test.go`
- `apps/web/e2e/**`
