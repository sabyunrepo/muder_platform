# PR-C1 — L1 Editor SchemaDrivenForm (MVP)

**Wave**: 6 · **Parallel**: ×2 · **Depends on**: T1 · **Worktree**: required

## Scope globs
- `apps/web/src/features/editor/SchemaDrivenForm.tsx` (new)
- `apps/web/src/features/editor/SchemaField.tsx` (new)
- `apps/web/src/features/editor/EditorPage.tsx` (new)
- `apps/web/src/features/editor/GenreSelect.tsx` (new)
- `apps/web/src/features/editor/PresetSelect.tsx` (new)
- `apps/web/src/features/editor/types.ts` (new)
- `apps/web/src/features/editor/index.ts` (new)
- `apps/web/src/features/editor/__tests__/*.test.tsx` (new)
- `apps/web/src/api/templateApi.ts` (new)
- `apps/web/src/stores/editor/themeStore.ts` (new)

## Context
L1 에디터 MVP. 백엔드의 `GET /api/templates/{id}/schema` 를 호출해서 받은 JSON Schema 로 자동 폼 UI 생성.
L2/L3 은 별도 phase.

## Tasks

1. **templateApi** — BaseAPI 상속, `listTemplates()`, `getTemplate(id)`, `getSchema(id)`, `saveTheme(theme)`
2. **themeStore** — Zustand store, 편집 중인 theme 상태, 자동 저장 debounce
3. **SchemaField** — 재귀 필드 렌더러 (string → TextField, enum → SelectBox, number → NumberInput, boolean → Switch, array → ArrayEditor, object → 재귀)
4. **SchemaDrivenForm** — JSON Schema → `SchemaField[]` 파싱, `value/onChange` 바인딩
5. **GenreSelect / PresetSelect** — 드롭다운 UI, templateApi 호출
6. **EditorPage** — 3 컬럼 레이아웃 (장르 선택 / 폼 / 미리보기), Seed Design Layout
7. **tests** — Vitest + Testing Library, MSW 로 `/schema` mock, 렌더 + change 이벤트

## Verification
- `pnpm build` clean
- `pnpm test` all green
- `pnpm lint` clean
- vitest 커버리지 ≥ 70%
- Seed Design 컴포넌트 사용 (@jittda/ui TextField/SelectBox/Switch/Chip, lucide-react 아이콘)
- 수동 확인: 4 장르 각 프리셋 로드 → 폼 렌더 → 필드 수정 → 저장

## 규칙 준수 체크
- [ ] 네이티브 HTML (button/input/select) 사용 금지 — @jittda/ui 만
- [ ] Layout 은 @seed-design/react (Flex/VStack/HStack)
- [ ] 아이콘 lucide-react 만
- [ ] API 는 BaseAPI 상속, fetch 직접 호출 금지
- [ ] 폴더: components/pages/hooks/api/types/utils/constants

## Parallel-safety notes
- F1 (백엔드) 와 완전히 다른 스택 — 충돌 불가
