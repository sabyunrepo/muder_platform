import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryClient } from "@/services/queryClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ThemeStatus = "DRAFT" | "PUBLISHED";

export interface EditorThemeSummary {
  id: string;
  title: string;
  status: ThemeStatus;
  min_players: number;
  max_players: number;
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
  status: ThemeStatus;
  config_json: Record<string, unknown> | null;
  version: number;
  created_at: string;
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
}

export interface UpdateThemeRequest {
  title?: string;
  description?: string;
  cover_image?: string;
  min_players?: number;
  max_players?: number;
  duration_min?: number;
  price?: number;
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

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const editorKeys = {
  all: ["editor"] as const,
  themes: () => [...editorKeys.all, "themes"] as const,
  theme: (id: string) => [...editorKeys.all, "themes", id] as const,
  characters: (themeId: string) =>
    [...editorKeys.all, "themes", themeId, "characters"] as const,
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
// Character Queries (theme detail에서 characters 필드로 제공되지만,
// 별도 쿼리가 필요한 경우를 위해 theme 상세에서 추출)
// ---------------------------------------------------------------------------

export function useEditorCharacters(themeId: string) {
  return useQuery<EditorCharacterResponse[]>({
    queryKey: editorKeys.characters(themeId),
    queryFn: async () => {
      const theme = await api.get<EditorThemeResponse & { characters?: EditorCharacterResponse[] }>(
        `/v1/editor/themes/${themeId}`,
      );
      return theme.characters ?? [];
    },
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
