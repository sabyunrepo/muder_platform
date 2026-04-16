import { useMutation } from "@tanstack/react-query";
import { api, type ApiError } from "@/services/api";
import { queryClient } from "@/services/queryClient";
import { ApiHttpError, isApiHttpError } from "@/lib/api-error";
import type { EditorThemeResponse } from "@/features/editor/api";
import { editorKeys } from "@/features/editor/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * RFC 9457 extension surfaced on optimistic-lock 409 from
 * `PUT /v1/editor/themes/{id}/config`. Backend (PR-2) attaches this so the
 * client can rebase locally and retry once without user-facing modal.
 */
interface ConflictExtensions {
  current_version?: number;
}

/**
 * Payload must carry a `version` field so the server can detect optimistic
 * lock conflicts. The rebase path rewrites this to `current_version` and
 * retries once.
 */
export type ConfigPayload = Record<string, unknown> & { version?: number };

export interface UpdateConfigOptions {
  /** Invoked once when the silent rebase+retry fails with 409 again. */
  onConflictAfterRetry?: (error: ApiError) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract `current_version` from an ApiError's `extensions` bag. Returns
 * `null` when absent (back-compat: old servers omit it).
 */
export function readCurrentVersion(error: ApiError | undefined): number | null {
  if (!error) return null;
  const ext = (error as ApiError & { extensions?: ConflictExtensions }).extensions;
  const v = ext?.current_version;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function isConflict(error: unknown): error is ApiHttpError {
  return isApiHttpError(error) && error.status === 409;
}

// ---------------------------------------------------------------------------
// Mutation: PUT /v1/editor/themes/{id}/config with silent rebase
// ---------------------------------------------------------------------------

/**
 * `useUpdateConfigJson` mutates the theme config_json with a one-shot silent
 * rebase on optimistic-lock 409:
 *
 * 1. First attempt fails with 409 + `extensions.current_version` → rewrite
 *    `payload.version` and retry once (no modal).
 * 2. Second attempt succeeds → normal onSuccess path.
 * 3. Second attempt fails again → `onConflictAfterRetry` fires so the caller
 *    can show a Snackbar and invalidate the theme query.
 * 4. 409 without `current_version` (legacy server) → skip retry, treat as
 *    conflict-after-retry so the caller still surfaces a Snackbar.
 *
 * Retry logic is implemented in `mutationFn` (not react-query's `retry`)
 * because we need to mutate the payload between attempts.
 */
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
          // Legacy 409 without extension — surface as conflict-after-retry
          // so the caller can still show the Snackbar + invalidate.
          onConflictAfterRetry?.(err.apiError);
          throw err;
        }

        // Rebase payload version and retry once. Any error here (including
        // another 409) is final.
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
