---
name: Phase 11.0 메타포 테스트 게임
description: 단서 아이템 시스템 + 메타포 6인 템플릿 + E2E 테스트 (2026-04-13 완료)
type: project
---
Phase 11.0 — 메타포 테스트 게임 구현 **완료**.

**Why:** 33개 모듈 + PhaseEngine 완성 상태에서 실제 게임 데이터로 E2E 검증 필요. 메타포(머더미스터리 6인)를 테스트 대상으로 선정.

**결과:**
- 5 PR, 4 Wave 전부 main에 머지 완료
- PR-1 `1bfdc5e` — 단서 아이템 시스템 (DB 4컬럼 + ClueInteraction peek 구현)
- PR-2 `3a81f44` — 에디터 ClueForm 아이템 설정 UI
- PR-3 `9831f19` — 게임 CluePanel 아이템 사용 + ItemUseModal
- PR-4 `9df6efe` — 메타포 6인 JSON 템플릿 + DB 시드 SQL
- PR-5 `8116dc6` — Go 통합 테스트 9개 (race clean)
- 전체 `go test -race ./...` 통과, `tsc --noEmit` 통과

**How to apply:**
- 플랜 경로: `docs/plans/2026-04-13-metaphor-test/`
- 핵심 변경: ClueInteraction 모듈에 아이템 사용(peek) 플로우 (뮤텍스 + 30초 타임아웃 + 이벤트 브로드캐스트)
- 다음 단계: 다른 아이템 효과(steal/reveal/block/swap) 구현, 실제 서버에서 시드 데이터 로드 후 브라우저 QA
