import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryClient } from "@/services/queryClient";
import { editorKeys } from "./keys";
import type {
  ContentResponse,
  EditorThemeResponse,
  ValidationResponse,
} from "./types";

// ---------------------------------------------------------------------------
// Content / Config / Validation
// ---------------------------------------------------------------------------

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
