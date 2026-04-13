# PR-2 — 에디터 아이템 설정 UI

**Wave**: 2 · **Parallel**: ×2 · **Depends on**: PR-1 · **Branch**: `feat/editor-item-ui`

## Context
ClueForm에 아이템 설정 UI 추가. is_usable 토글 → 하위 필드(effect, target, consumed) 노출.

## Tasks

### T1: API 타입 업데이트
- [ ] `features/editor/api.ts` — ClueResponse, CreateClueRequest, UpdateClueRequest에 아이템 필드 추가

### T2: ClueForm 아이템 섹션
- [ ] `features/editor/components/ClueForm.tsx` — is_usable 토글 + 조건부 하위 필드
- [ ] effect: select (peek/steal/reveal/block/swap)
- [ ] target: select (player/clue/self)
- [ ] consumed: checkbox (기본 true)

### T3: 빌드 검증
- [ ] TypeScript 빌드 통과
- [ ] 에디터에서 단서 생성/수정 시 아이템 필드 저장 확인

## scope_globs
- `apps/web/src/features/editor/api.ts`
- `apps/web/src/features/editor/components/ClueForm.tsx`
