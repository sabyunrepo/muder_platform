import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryClient } from "@/services/queryClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ThemeStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "UNPUBLISHED" | "SUSPENDED";

export interface EditorThemeSummary {
  id: string;
  title: string;
  status: ThemeStatus;
  min_players: number;
  max_players: number;
  coin_price: number;
  version: number;
  created_at: string;
}

export interface EditorThemeResponse {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_image: string | null;
  min_players: number;
  max_players: number;
  duration_min: number;
  price: number;
  coin_price: number;
  status: ThemeStatus;
  config_json: Record<string, unknown> | null;
  version: number;
  created_at: string;
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface EditorCharacterResponse {
  id: string;
  theme_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  is_culprit: boolean;
  sort_order: number;
}

export interface CreateThemeRequest {
  title: string;
  description?: string;
  cover_image?: string;
  min_players: number;
  max_players: number;
  duration_min: number;
  price?: number;
  coin_price?: number;
}

export interface UpdateThemeRequest {
  title: string;
  description?: string;
  cover_image?: string;
  min_players: number;
  max_players: number;
  duration_min: number;
  price: number;
  coin_price: number;
}

export interface CreateCharacterRequest {
  name: string;
  description?: string;
  image_url?: string;
  is_culprit?: boolean;
  sort_order?: number;
}

export interface UpdateCharacterRequest {
  name?: string;
  description?: string;
  image_url?: string;
  is_culprit?: boolean;
  sort_order?: number;
}

export interface CreateClueRequest {
  name: string;
  description?: string;
  image_url?: string;
  clue_type?: string;
  level?: number;
  is_common?: boolean;
  sort_order?: number;
  location_id?: string;
  is_usable?: boolean;
  use_effect?: string;
  use_target?: string;
  use_consumed?: boolean;
}

export interface UpdateClueRequest {
  name?: string;
  description?: string;
  image_url?: string;
  clue_type?: string;
  level?: number;
  is_common?: boolean;
  sort_order?: number;
  location_id?: string;
  is_usable?: boolean;
  use_effect?: string;
  use_target?: string;
  use_consumed?: boolean;
}

// ---------------------------------------------------------------------------
// Maps / Locations / Clues / Contents / Validation types
// ---------------------------------------------------------------------------

export interface MapResponse {
  id: string;
  theme_id: string;
  name: string;
  image_url: string | null;
  sort_order: number;
  created_at: string;
}

export interface CreateMapRequest {
  name: string;
  image_url?: string;
  sort_order?: number;
}

export interface LocationResponse {
  id: string;
  theme_id: string;
  map_id: string;
  name: string;
  restricted_characters: string | null;
  sort_order: number;
  created_at: string;
}

export interface ClueResponse {
  id: string;
  theme_id: string;
  location_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  is_common: boolean;
  level: number;
  clue_type: string;
  sort_order: number;
  created_at: string;
  is_usable: boolean;
  use_effect: string | null;
  use_target: string | null;
  use_consumed: boolean;
}

export interface ContentResponse {
  id: string;
  theme_id: string;
  key: string;
  body: string;
  updated_at: string;
}

export interface ValidationResponse {
  valid: boolean;
  errors: string[];
  stats: {
    characters: number;
    maps: number;
    locations: number;
    clues: number;
  };
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export type JSONSchema = import("@/features/editor/templateApi").JSONSchemaProperty;

export interface ModuleSchemasResponse {
  schemas: Record<string, JSONSchema>;
}

export const editorKeys = {
  all: ["editor"] as const,
  themes: () => [...editorKeys.all, "themes"] as const,
  theme: (id: string) => [...editorKeys.all, "themes", id] as const,
  characters: (themeId: string) =>
    [...editorKeys.all, "themes", themeId, "characters"] as const,
  maps: (themeId: string) =>
    [...editorKeys.all, "themes", themeId, "maps"] as const,
  locations: (themeId: string) =>
    [...editorKeys.all, "themes", themeId, "locations"] as const,
  clues: (themeId: string) =>
    [...editorKeys.all, "themes", themeId, "clues"] as const,
  content: (themeId: string, key: string) =>
    [...editorKeys.all, "themes", themeId, "content", key] as const,
  moduleSchemas: () => [...editorKeys.all, "module-schemas"] as const,
};

// ---------------------------------------------------------------------------
// Theme Queries
// ---------------------------------------------------------------------------

export function useEditorThemes() {
  return useQuery<EditorThemeSummary[]>({
    queryKey: editorKeys.themes(),
    queryFn: () => api.get<EditorThemeSummary[]>("/v1/editor/themes"),
  });
}

export function useEditorTheme(id: string) {
  return useQuery<EditorThemeResponse>({
    queryKey: editorKeys.theme(id),
    queryFn: () => api.get<EditorThemeResponse>(`/v1/editor/themes/${id}`),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Theme Mutations
// ---------------------------------------------------------------------------

export function useCreateTheme() {
  return useMutation<EditorThemeResponse, Error, CreateThemeRequest>({
    mutationFn: (body) =>
      api.post<EditorThemeResponse>("/v1/editor/themes", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.themes() });
    },
  });
}

export function useUpdateTheme(themeId: string) {
  return useMutation<EditorThemeResponse, Error, UpdateThemeRequest>({
    mutationFn: (body) =>
      api.put<EditorThemeResponse>(`/v1/editor/themes/${themeId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.theme(themeId) });
      queryClient.invalidateQueries({ queryKey: editorKeys.themes() });
    },
  });
}

export function useDeleteTheme() {
  return useMutation<void, Error, string>({
    mutationFn: (themeId) =>
      api.deleteVoid(`/v1/editor/themes/${themeId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.themes() });
    },
  });
}

export function usePublishTheme(themeId: string) {
  return useMutation<EditorThemeResponse, Error, void>({
    mutationFn: () =>
      api.post<EditorThemeResponse>(`/v1/editor/themes/${themeId}/publish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.theme(themeId) });
      queryClient.invalidateQueries({ queryKey: editorKeys.themes() });
    },
  });
}

export function useUnpublishTheme(themeId: string) {
  return useMutation<EditorThemeResponse, Error, void>({
    mutationFn: () =>
      api.post<EditorThemeResponse>(`/v1/editor/themes/${themeId}/unpublish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.theme(themeId) });
      queryClient.invalidateQueries({ queryKey: editorKeys.themes() });
    },
  });
}

export function useSubmitForReview(themeId: string) {
  return useMutation<EditorThemeResponse, Error, void>({
    mutationFn: () =>
      api.post<EditorThemeResponse>(`/v1/editor/themes/${themeId}/submit-review`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.theme(themeId) });
      queryClient.invalidateQueries({ queryKey: editorKeys.themes() });
    },
  });
}

export function useEditorContent(themeId: string, key: string) {
  return useQuery<ContentResponse>({
    queryKey: editorKeys.content(themeId, key),
    queryFn: () => api.get<ContentResponse>(`/v1/editor/themes/${themeId}/content/${key}`),
    enabled: !!themeId && !!key,
    retry: false,
  });
}

export function useUpsertContent(themeId: string, key: string) {
  return useMutation<ContentResponse, Error, { body: string }>({
    mutationFn: (data) =>
      api.put<ContentResponse>(`/v1/editor/themes/${themeId}/content/${key}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.content(themeId, key) });
    },
  });
}

export function useValidateTheme(themeId: string) {
  return useMutation<ValidationResponse, Error, void>({
    mutationFn: () => api.post<ValidationResponse>(`/v1/editor/themes/${themeId}/validate`),
  });
}

export function useUpdateConfigJson(themeId: string) {
  return useMutation<EditorThemeResponse, Error, Record<string, unknown>>({
    mutationFn: (config) =>
      api.put<EditorThemeResponse>(
        `/v1/editor/themes/${themeId}/config`,
        config,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.theme(themeId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Character Queries
// ---------------------------------------------------------------------------

export function useEditorCharacters(themeId: string) {
  return useQuery<EditorCharacterResponse[]>({
    queryKey: editorKeys.characters(themeId),
    queryFn: () => api.get<EditorCharacterResponse[]>(`/v1/editor/themes/${themeId}/characters`),
    enabled: !!themeId,
  });
}

// ---------------------------------------------------------------------------
// Character Mutations
// ---------------------------------------------------------------------------

export function useCreateCharacter(themeId: string) {
  return useMutation<EditorCharacterResponse, Error, CreateCharacterRequest>({
    mutationFn: (body) =>
      api.post<EditorCharacterResponse>(
        `/v1/editor/themes/${themeId}/characters`,
        body,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.characters(themeId) });
      queryClient.invalidateQueries({ queryKey: editorKeys.theme(themeId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Module Schemas
// ---------------------------------------------------------------------------

export function useModuleSchemas() {
  return useQuery<ModuleSchemasResponse>({
    queryKey: editorKeys.moduleSchemas(),
    queryFn: () => api.get<ModuleSchemasResponse>("/v1/editor/module-schemas"),
    staleTime: 5 * 60 * 1000, // schemas are static; cache for 5 min
  });
}

export function useUpdateCharacter(themeId: string) {
  return useMutation<
    EditorCharacterResponse,
    Error,
    { characterId: string; body: UpdateCharacterRequest }
  >({
    mutationFn: ({ characterId, body }) =>
      api.put<EditorCharacterResponse>(
        `/v1/editor/characters/${characterId}`,
        body,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.characters(themeId) });
      queryClient.invalidateQueries({ queryKey: editorKeys.theme(themeId) });
    },
  });
}

export function useDeleteCharacter(themeId: string) {
  return useMutation<void, Error, string>({
    mutationFn: (characterId) =>
      api.deleteVoid(`/v1/editor/characters/${characterId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.characters(themeId) });
      queryClient.invalidateQueries({ queryKey: editorKeys.theme(themeId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Re-exports: Clue hooks (from editorClueApi.ts)
// ---------------------------------------------------------------------------

export { useEditorClues, useCreateClue, useUpdateClue, useDeleteClue } from "./editorClueApi";

// ---------------------------------------------------------------------------
// Re-exports: Map/Location types & hooks (from editorMapApi.ts)
// ---------------------------------------------------------------------------

export type { UpdateMapRequest, CreateLocationRequest, UpdateLocationRequest } from "./editorMapApi";
export {
  useEditorMaps, useCreateMap, useUpdateMap, useDeleteMap,
  useEditorLocations, useCreateLocation, useUpdateLocation, useDeleteLocation,
} from "./editorMapApi";
