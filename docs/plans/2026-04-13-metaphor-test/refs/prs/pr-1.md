# PR-1 — 단서 아이템 시스템 (DB + 백엔드)

**Wave**: 1 · **Parallel**: ×1 · **Depends on**: — · **Branch**: `feat/clue-item-system`

## Context
단서(clue)에 사용 가능 속성을 추가. ClueInteraction 모듈에 아이템 사용 플로우(선언→대상→결과) 구현.

## Tasks

### T1: DB 마이그레이션
- [ ] `db/migrations/` — clues 테이블에 4컬럼 추가 (is_usable, use_effect, use_target, use_consumed)
- [ ] `db/queries/editor.sql` — CreateClue, UpdateClue 쿼리에 신규 필드 반영
- [ ] `sqlc generate` 실행

### T2: 에디터 백엔드 (타입 + 핸들러)
- [ ] `internal/domain/editor/types.go` — CreateClueRequest, UpdateClueRequest에 아이템 필드 추가
- [ ] `internal/domain/editor/service.go` — clue CRUD에 아이템 필드 전달
- [ ] `internal/domain/editor/handler.go` — 변경 없음 (자동 바인딩)

### T3: ClueInteraction 모듈 확장
- [ ] `internal/module/core/clue_interaction.go` — ItemUseState 구조체 추가
- [ ] HandleMessage에 `clue:use`, `clue:use_target`, `clue:use_cancel` 케이스 추가
- [ ] peek 효과 구현: 대상 플레이어 보유 단서 목록 → 선택 → 상세 반환
- [ ] 뮤텍스: activeItemUse 필드 + 30초 타임아웃
- [ ] SaveState/RestoreState에 usedItems 반영

### T4: 테스트
- [ ] `internal/module/core/clue_interaction_test.go` — 아이템 사용 플로우 테스트
- [ ] peek 효과, 뮤텍스 동시 사용 차단, 타임아웃 해제 테스트

## scope_globs
- `apps/server/db/migrations/**`
- `apps/server/db/queries/editor.sql`
- `apps/server/internal/db/editor.sql.go`
- `apps/server/internal/db/models.go`
- `apps/server/internal/domain/editor/types.go`
- `apps/server/internal/domain/editor/service.go`
- `apps/server/internal/module/core/clue_interaction.go`
- `apps/server/internal/module/core/clue_interaction_test.go`
