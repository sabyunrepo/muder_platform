// ---------------------------------------------------------------------------
// Editor API — barrel (type-only + named re-exports)
// ---------------------------------------------------------------------------
//
// The original `features/editor/api.ts` file grew past the 400-line TS/TSX
// tier. It was split into a directory keeping all public exports stable so
// consumers of `@/features/editor/api` continue to work without changes.

// Types -----------------------------------------------------------------
export type {
  ThemeStatus,
  EditorThemeSummary,
  EditorThemeResponse,
  EditorCharacterResponse,
  CreateThemeRequest,
  UpdateThemeRequest,
  CreateCharacterRequest,
  UpdateCharacterRequest,
  CreateClueRequest,
  UpdateClueRequest,
  MapResponse,
  CreateMapRequest,
  LocationResponse,
  ClueResponse,
  ContentResponse,
  ValidationResponse,
  JSONSchema,
  ModuleSchemasResponse,
} from "./types";

// Query keys ------------------------------------------------------------
export { editorKeys } from "./keys";

// Theme hooks -----------------------------------------------------------
export {
  useEditorThemes,
  useEditorTheme,
  useCreateTheme,
  useUpdateTheme,
  useDeleteTheme,
  usePublishTheme,
  useUnpublishTheme,
  useSubmitForReview,
} from "./themes";

// Character hooks -------------------------------------------------------
export {
  useEditorCharacters,
  useCreateCharacter,
  useUpdateCharacter,
  useDeleteCharacter,
} from "./characters";

// Content / config / validation ----------------------------------------
export {
  useEditorContent,
  useUpsertContent,
  useValidateTheme,
  useUpdateConfigJson,
} from "./content";

// Module schemas -------------------------------------------------------
export { useModuleSchemas } from "./moduleSchemas";

// Re-exports: Clue hooks (from editorClueApi.ts) -----------------------
export {
  useEditorClues,
  useCreateClue,
  useUpdateClue,
  useDeleteClue,
} from "../editorClueApi";

// Re-exports: Map/Location types & hooks (from editorMapApi.ts) --------
export type {
  UpdateMapRequest,
  CreateLocationRequest,
  UpdateLocationRequest,
} from "../editorMapApi";
export {
  useEditorMaps,
  useCreateMap,
  useUpdateMap,
  useDeleteMap,
  useEditorLocations,
  useCreateLocation,
  useUpdateLocation,
  useDeleteLocation,
} from "../editorMapApi";
