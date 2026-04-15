# Phase 18.4 — 조사 findings (소스 경로 상세)

## Backend
- `apps/server/cmd/server/main.go` (L316-479) — Chi 라우터
  - L427: `r.Put("/themes/{id}/config", editorHandler.UpdateConfigJson)` ✓
  - L444: `r.Get("/themes/{id}/clue-relations", editorHandler.GetClueRelations)` ✓
  - L457: `r.Post("/themes/{id}/images/upload-url", imageHandler.RequestUpload)` ✓
  - L473: `r.Patch("/themes/{id}/flow/nodes/{nodeId}", flowHandler.UpdateNode)` — **PUT 미등록**
  - `/api/v1/templates` — **미등록**
- `internal/domain/editor/service.go:486-499` — UpdateThemeConfigJson optimistic lock (`pgx.ErrNoRows` → `Conflict("theme was modified by another session")`)
- `internal/domain/editor/clue_relation_handler.go:12` — GetClueRelations (빈 결과 시 500 가능성)
- `internal/domain/server/template_handler.go:23` — ListTemplates 정의되어 있으나 라우터 미등록

## Frontend
- `apps/web/src/services/api.ts` (L23/105/163/167) — rawFetch/request/post/put
- `apps/web/src/features/editor/editorClueApi.ts:24-32` — useCreateClue onSuccess invalidate
- `apps/web/src/features/editor/components/design/CharacterAssignPanel.tsx:52-76` — saveConfig 500ms debounce, optimistic 없음
- `apps/web/src/features/editor/components/design/PhaseNodePanel.tsx:43` — 500ms debounce
- `apps/web/src/features/editor/components/design/ModulesSubTab.tsx:40-53` — 모듈 토글 mutation
- `apps/web/src/features/editor/components/design/LocationsSubTab.tsx` — CRUD만, 배치 UI 없음
- `apps/web/src/features/editor/components/ImageCropUpload.tsx:93` — handleConfirm → uploadImage
- `apps/web/src/features/editor/imageApi.ts:67` — uploadImage (upload-url POST)
- `apps/web/src/features/editor/templateApi.ts:64` — `api.get("/v1/templates")`
- `apps/web/src/features/editor/hooks/useAutoSave.ts:34` — debounceMs=5000 (default), 현재 미활용

## 설계 참조
- 이미지 업로드: `docs/plans/2026-04-13-image-upload-design.md` (presigned 3-step)
- clue-relations: `docs/plans/2026-04-14-clue-graph/` (Phase 17.5)
- flow canvas: `docs/plans/2026-04-14-flow-canvas/refs/scope-and-decisions.md` (PATCH + 벌크 PUT)
- config autosave: `docs/plans/2026-04-10-editor-engine-redesign/refs/phase-c-prs/c6-autosave-validation.md` (409 modal)
- location placement 설계: **없음** (본 Phase 에서 mini-spec 작성)
