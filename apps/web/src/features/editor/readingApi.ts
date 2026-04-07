import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "@/services/api";
import { queryClient } from "@/services/queryClient";

// ---------------------------------------------------------------------------
// Types — match backend exactly
//
// IMPORTANT: The wire protocol mixes two casing conventions:
//   - The OUTER wrapper (CreateReadingSectionRequest, ReadingSectionResponse,
//     UpdateReadingSectionRequest) uses camelCase JSON tags.
//   - The INNER ReadingLineDTO inside `lines[]` uses PascalCase JSON tags
//     because the storage JSONB column round-trips with the engine's
//     progression.ReadingLine struct (Go field names).
// Do not "normalize" either side — both must match the backend exactly.
// ---------------------------------------------------------------------------

/**
 * AdvanceBy controls how a reading line advances to the next.
 *  - "voice"      → advances when the line's voice clip finishes
 *  - "gm"         → advances on explicit GM action
 *  - "role:<id>"  → advances on action from the player assigned to that role
 *  - ""           → unset (defaults to engine policy)
 */
export type AdvanceBy = "voice" | "gm" | `role:${string}` | "";

/**
 * A single reading line. Field names are PascalCase to match the JSONB
 * shape stored by the backend (which mirrors progression.ReadingLine).
 */
export interface ReadingLineDTO {
  Index: number;
  Text: string;
  Speaker?: string;
  VoiceMediaID?: string;
  AdvanceBy?: AdvanceBy;
}

export interface CreateReadingSectionRequest {
  name: string;
  bgmMediaId?: string | null;
  lines: ReadingLineDTO[];
  sortOrder: number;
}

/**
 * UpdateReadingSectionRequest implements the triple-state pattern for
 * `bgmMediaId` (backend uses **string):
 *   - field omitted (key not present) → keep current value
 *   - `null`                          → clear bgm
 *   - `"<uuid>"`                      → set to that media id
 *
 * Use {@link buildUpdateBody} to serialize patches so that `undefined`
 * values are stripped while `null` is preserved.
 */
export interface UpdateReadingSectionRequest {
  name?: string;
  bgmMediaId?: string | null;
  lines?: ReadingLineDTO[];
  sortOrder?: number;
  /** Optimistic-lock version. Required on every PATCH. */
  version: number;
}

export interface ReadingSectionResponse {
  id: string;
  themeId: string;
  name: string;
  bgmMediaId?: string | null;
  lines: ReadingLineDTO[];
  sortOrder: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const readingKeys = {
  all: ["reading-sections"] as const,
  list: (themeId: string) => ["reading-sections", themeId] as const,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validates an AdvanceBy string. Accepts:
 *   - "" (empty / unset)
 *   - "voice"
 *   - "gm"
 *   - "role:<non-empty>"
 */
export function isValidAdvanceBy(s: string): boolean {
  if (s === "" || s === "voice" || s === "gm") return true;
  return s.startsWith("role:") && s.length > "role:".length;
}

/**
 * Strip `undefined` keys from the patch body so that JSON.stringify omits
 * them entirely (backend sees nil pointer = "keep current"). Crucially,
 * `null` values are preserved (backend sees *string pointing to nil =
 * "clear field"). This is the wire encoding for the triple-state pattern.
 */
export function buildUpdateBody(
  patch: UpdateReadingSectionRequest,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useReadingSections(themeId: string) {
  return useQuery<ReadingSectionResponse[]>({
    queryKey: readingKeys.list(themeId),
    queryFn: () =>
      api.get<ReadingSectionResponse[]>(
        `/v1/editor/themes/${themeId}/reading-sections`,
      ),
    enabled: !!themeId,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateReadingSection(themeId: string) {
  return useMutation<ReadingSectionResponse, Error, CreateReadingSectionRequest>({
    mutationFn: (body) =>
      api.post<ReadingSectionResponse>(
        `/v1/editor/themes/${themeId}/reading-sections`,
        body,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: readingKeys.list(themeId) });
    },
  });
}

export function useUpdateReadingSection(themeId: string) {
  return useMutation<
    ReadingSectionResponse,
    Error,
    { id: string; patch: UpdateReadingSectionRequest }
  >({
    mutationFn: ({ id, patch }) =>
      api.patch<ReadingSectionResponse>(
        `/v1/editor/reading-sections/${id}`,
        buildUpdateBody(patch),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: readingKeys.list(themeId) });
    },
  });
}

export function useDeleteReadingSection(themeId: string) {
  return useMutation<void, Error, string>({
    mutationFn: (id) => api.deleteVoid(`/v1/editor/reading-sections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: readingKeys.list(themeId) });
    },
  });
}
