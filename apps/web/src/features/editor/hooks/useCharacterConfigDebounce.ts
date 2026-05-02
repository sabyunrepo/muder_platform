import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { EditorThemeResponse } from "@/features/editor/api";
import { editorKeys, useUpdateConfigJson } from "@/features/editor/api";
import { useDebouncedMutation } from "@/hooks/useDebouncedMutation";
import { normalizeConfigForSave } from "@/features/editor/utils/configShape";

/** Debounce window for config saves (W2 PR-5: 500→1500ms). */
const SAVE_DEBOUNCE_MS = 1500;

export type ConfigPatch = Record<string, unknown>;

export interface UseCharacterConfigDebounceReturn {
  saveConfig: (updates: ConfigPatch) => void;
  flush: () => void;
}

/**
 * useCharacterConfigDebounce — `CharacterAssignPanel`의 debounce + optimistic
 * + rollback + onBlur flush 합성을 캡슐화한다 (Phase 21 E-8).
 *
 * 두 layer 패턴 (PR #184, round-2 N-1 / CodeRabbit):
 *
 *  1. **schedule-time UI mirror** — 토글 즉시 반응이 critical하므로 `saveConfig`
 *     본문에서 직접 `setQueryData`로 캐시를 갱신한다.
 *  2. **flush-time `applyOptimistic`** — `pendingSnapshotRef`에 저장한 *진짜*
 *     pre-edit 스냅샷을 기준으로 rollback closure를 작성한다. mirror 후의
 *     캐시를 캡처하면 silent data divergence가 발생.
 *
 * 자세한 카논: `memory/feedback_optimistic_apply_timing.md`,
 *            `memory/feedback_optimistic_rollback_snapshot.md`.
 */
export function useCharacterConfigDebounce(
  themeId: string,
  themeConfigJson: Record<string, unknown> | undefined,
): UseCharacterConfigDebounceReturn {
  const updateConfig = useUpdateConfigJson(themeId);
  const queryClient = useQueryClient();

  // Pre-edit snapshot captured at the FIRST schedule of a debounce window —
  // distinct from the schedule-time UI mirror that follows. This is the
  // correct rollback target on mutation failure (round-2 N-1 / CodeRabbit).
  // Cleared after the mutation settles (success or rollback) so the next
  // edit window starts fresh.
  const pendingSnapshotRef = useRef<EditorThemeResponse | undefined>(undefined);

  const debouncer = useDebouncedMutation<ConfigPatch>({
    debounceMs: SAVE_DEBOUNCE_MS,
    mutate: (body, opts) =>
      updateConfig.mutate(body, {
        onSuccess: () => {
          toast.success("저장되었습니다");
          pendingSnapshotRef.current = undefined;
        },
        onError: (err) => {
          opts.onError(err);
          pendingSnapshotRef.current = undefined;
        },
      }),
    applyOptimistic: () => {
      const previous = pendingSnapshotRef.current;
      if (!previous) return null;
      const cacheKey = editorKeys.theme(themeId);
      return () => queryClient.setQueryData(cacheKey, previous);
    },
    onError: () => toast.error("저장에 실패했습니다"),
  });

  const saveConfig = useCallback(
    (updates: ConfigPatch) => {
      const cacheKey = editorKeys.theme(themeId);

      if (!pendingSnapshotRef.current) {
        pendingSnapshotRef.current =
          queryClient.getQueryData<EditorThemeResponse>(cacheKey);
      }

      const cacheNow = queryClient.getQueryData<EditorThemeResponse>(cacheKey);
      if (cacheNow) {
        queryClient.setQueryData<EditorThemeResponse>(cacheKey, {
          ...cacheNow,
          config_json: normalizeConfigForSave({ ...(cacheNow.config_json ?? {}), ...updates }),
        });
      }

      // Merge basis priority (H-W2-1): pending body > optimistic cache >
      // theme.config_json. Prevents loss of earlier edits made within the
      // same debounce window on different keys.
      debouncer.schedule(updates, (prev) => {
        const cached =
          queryClient.getQueryData<EditorThemeResponse>(cacheKey)?.config_json;
        const basis = prev ?? cached ?? themeConfigJson ?? {};
        return normalizeConfigForSave({ ...basis, ...updates });
      });
    },
    // `themeConfigJson` is deliberately in deps as the *last-resort* merge
    // basis — even though pending/cached fallbacks usually win, capturing the
    // latest prop identity keeps the rare cold-start path correct.
    [debouncer, queryClient, themeConfigJson, themeId],
  );

  return { saveConfig, flush: debouncer.flush };
}
