import { useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Package, MapPin, Check } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Spinner } from '@/shared/components/ui/Spinner';
import type {
  EditorThemeResponse,
  LocationResponse,
  ClueResponse,
} from '@/features/editor/api';
import { editorKeys, useEditorClues, useUpdateConfigJson } from '@/features/editor/api';
import { readLocationClueIds, writeLocationClueIds } from '@/features/editor/editorTypes';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LocationClueAssignPanelProps {
  themeId: string;
  theme: EditorThemeResponse;
  location: LocationResponse;
  /** Override clue list (mainly for tests); defaults to `useEditorClues`. */
  allClues?: ClueResponse[];
  /** Optional callback after a successful config update. */
  onChange?: (clueIds: string[]) => void;
}

// ---------------------------------------------------------------------------
// LocationClueAssignPanel
//
// Renders every clue in the theme as a toggleable chip. Selected chips are
// the ones currently assigned to `location.id` inside
// `theme.config_json.locations[].clueIds`. Toggling a chip rewrites the
// config blob via `useUpdateConfigJson`.
// ---------------------------------------------------------------------------

export function LocationClueAssignPanel({
  themeId,
  theme,
  location,
  allClues,
  onChange,
}: LocationClueAssignPanelProps) {
  const { data: fetchedClues, isLoading } = useEditorClues(themeId);
  const clues = allClues ?? fetchedClues ?? [];
  const updateConfig = useUpdateConfigJson(themeId);
  const queryClient = useQueryClient();
  const rollbackRef = useRef<EditorThemeResponse | undefined>(undefined);

  const assignedIds = useMemo(
    () => readLocationClueIds(theme.config_json, location.id),
    [theme.config_json, location.id],
  );
  const assignedSet = useMemo(() => new Set(assignedIds), [assignedIds]);

  function commit(next: string[]) {
    const nextConfig = writeLocationClueIds(theme.config_json, location.id, next);

    // Optimistic cache write: merge the next config into the theme snapshot so
    // the chip state reflects immediately without waiting for the PATCH round-trip.
    const cacheKey = editorKeys.theme(themeId);
    const previous = queryClient.getQueryData<EditorThemeResponse>(cacheKey);
    if (previous) {
      rollbackRef.current = previous;
      queryClient.setQueryData<EditorThemeResponse>(cacheKey, {
        ...previous,
        config_json: nextConfig,
      });
    }

    updateConfig.mutate(nextConfig, {
      onSuccess: () => {
        toast.success('단서 배정이 저장되었습니다');
        onChange?.(next);
      },
      onError: () => {
        if (rollbackRef.current) {
          queryClient.setQueryData(cacheKey, rollbackRef.current);
        }
        toast.error('단서 배정 저장에 실패했습니다');
      },
    });
  }

  function toggle(clueId: string) {
    const next = assignedSet.has(clueId)
      ? assignedIds.filter((id) => id !== clueId)
      : [...assignedIds, clueId];
    commit(next);
  }

  if (!allClues && isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Spinner size="sm" />
      </div>
    );
  }

  return (
    <section
      aria-label={`${location.name} 단서 배정`}
      className="rounded-sm border border-slate-800 bg-slate-950 p-3"
    >
      <header className="mb-3 flex items-center gap-2">
        <MapPin className="h-3.5 w-3.5 text-amber-500/70" />
        <h4 className="text-xs font-semibold text-slate-300">
          {location.name} — 단서 배정
        </h4>
        <span className="ml-1 text-[10px] text-slate-600">
          ({assignedIds.length}/{clues.length})
        </span>
      </header>

      {clues.length === 0 ? (
        <div className="rounded-sm border border-dashed border-slate-800 py-6 text-center">
          <Package className="mx-auto mb-2 h-5 w-5 text-slate-800" />
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-700">
            단서가 없습니다
          </p>
        </div>
      ) : (
        <ul className="flex flex-wrap gap-1.5" role="list">
          {clues.map((clue) => {
            const selected = assignedSet.has(clue.id);
            return (
              <li key={clue.id}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={selected}
                  aria-label={`${clue.name} 배정 토글`}
                  disabled={updateConfig.isPending}
                  onClick={() => toggle(clue.id)}
                  className={`group inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    selected
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {selected ? (
                    <Check className="h-3 w-3 shrink-0" />
                  ) : (
                    <Package className="h-3 w-3 shrink-0" />
                  )}
                  <span className="truncate max-w-[10rem]">{clue.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
