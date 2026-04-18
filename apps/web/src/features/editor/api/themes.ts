import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryClient } from "@/services/queryClient";
import { editorKeys } from "./keys";
import type {
  CreateThemeRequest,
  EditorThemeResponse,
  EditorThemeSummary,
  UpdateThemeRequest,
} from "./types";

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
