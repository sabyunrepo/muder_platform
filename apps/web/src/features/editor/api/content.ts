import { useQuery, useMutation } from "@tanstack/react-query";
import { ApiHttpError, isApiHttpError } from "@/lib/api-error";
import { api, type ApiError } from "@/services/api";
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

interface ConflictExtensions {
  current_version?: number;
}

export type ConfigPayload = Record<string, unknown> & { version?: number };

export interface UpdateConfigOptions {
  onConflictAfterRetry?: (error: ApiError) => void;
}

export function readCurrentVersion(error: ApiError | undefined): number | null {
  if (!error) return null;
  const ext = (error as ApiError & { extensions?: ConflictExtensions }).extensions;
  const v = ext?.current_version;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function isConflict(error: unknown): error is ApiHttpError {
  return isApiHttpError(error) && error.status === 409;
}

export function useUpdateConfigJson(
  themeId: string,
  options: UpdateConfigOptions = {},
) {
  const { onConflictAfterRetry } = options;

  return useMutation<EditorThemeResponse, Error, ConfigPayload>({
    mutationFn: async (config) => {
      try {
        return await api.put<EditorThemeResponse>(
          `/v1/editor/themes/${themeId}/config`,
          config,
        );
      } catch (err) {
        if (!isConflict(err)) throw err;

        const currentVersion = readCurrentVersion(err.apiError);
        if (currentVersion === null) {
          onConflictAfterRetry?.(err.apiError);
          throw err;
        }

        const rebased: ConfigPayload = { ...config, version: currentVersion };
        try {
          return await api.put<EditorThemeResponse>(
            `/v1/editor/themes/${themeId}/config`,
            rebased,
          );
        } catch (retryErr) {
          if (isConflict(retryErr)) {
            onConflictAfterRetry?.(retryErr.apiError);
          }
          throw retryErr;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: editorKeys.theme(themeId) });
    },
  });
}
