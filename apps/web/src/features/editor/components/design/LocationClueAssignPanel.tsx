import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, MapPin, Package, Plus, Search, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Spinner } from '@/shared/components/ui/Spinner';
import type { EditorThemeResponse, LocationResponse, ClueResponse } from '@/features/editor/api';
import { editorKeys, useEditorClues, useUpdateConfigJson } from '@/features/editor/api';
import { readLocationClueIds, writeLocationClueIds } from '@/features/editor/editorTypes';

interface LocationClueAssignPanelProps {
  themeId: string;
  theme: EditorThemeResponse;
  location: LocationResponse;
  allClues?: ClueResponse[];
  onChange?: (clueIds: string[]) => void;
}

function clueMeta(clue: ClueResponse) {
  return [clue.location_id ? '장소 단서' : '미배치', clue.is_common ? '공용' : null]
    .filter(Boolean)
    .join(' · ');
}

function roundLabel(clue: ClueResponse) {
  return typeof clue.reveal_round === 'number' ? `R${clue.reveal_round}` : 'CL';
}

export function LocationClueAssignPanel({
  themeId,
  theme,
  location,
  allClues,
  onChange,
}: LocationClueAssignPanelProps) {
  const { data: fetchedClues, isLoading } = useEditorClues(themeId);
  const clues = useMemo(() => allClues ?? fetchedClues ?? [], [allClues, fetchedClues]);
  const updateConfig = useUpdateConfigJson(themeId);
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');

  const assignedIds = useMemo(
    () => readLocationClueIds(theme.config_json, location.id),
    [theme.config_json, location.id]
  );
  const assignedSet = useMemo(() => new Set(assignedIds), [assignedIds]);
  const selectedClues = clues.filter((clue) => assignedSet.has(clue.id));
  const visibleClues = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clues;
    return clues.filter((clue) =>
      [clue.name, clue.description, clueMeta(clue), clue.reveal_round?.toString()]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [clues, query]);

  function commit(next: string[]) {
    const nextConfig = writeLocationClueIds(theme.config_json, location.id, next);
    const cacheKey = editorKeys.theme(themeId);
    const previous = queryClient.getQueryData<EditorThemeResponse>(cacheKey);
    if (previous)
      queryClient.setQueryData<EditorThemeResponse>(cacheKey, {
        ...previous,
        config_json: nextConfig,
      });
    updateConfig.mutate(nextConfig, {
      onSuccess: () => {
        toast.success('단서 배정이 저장되었습니다');
        onChange?.(next);
      },
      onError: () => {
        if (previous) queryClient.setQueryData(cacheKey, previous);
        toast.error('단서 배정 저장에 실패했습니다');
      },
    });
  }

  function addClue(clueId: string) {
    if (assignedSet.has(clueId)) return;
    commit([...assignedIds, clueId]);
  }

  function removeClue(clueId: string) {
    commit(assignedIds.filter((id) => id !== clueId));
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
      className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"
    >
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <MapPin className="h-3.5 w-3.5 text-amber-500/70" />
        <h4 className="text-sm font-semibold text-slate-200">{location.name} 단서 추가</h4>
        <span className="text-xs text-slate-600">
          ({assignedIds.length}/{clues.length})
        </span>
      </header>
      {clues.length === 0 ? (
        <EmptyClues />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(13rem,0.65fr)]">
          <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                전체 단서 목록
              </p>
              <span className="text-[10px] text-slate-600">
                {visibleClues.length}/{clues.length}개 표시
              </span>
            </div>
            <label className="relative mb-3 block">
              <span className="sr-only">단서 검색</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="단서명, 설명, 라운드 검색"
                aria-label="단서 검색"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
              />
            </label>
            <div className="max-h-80 space-y-1 overflow-auto pr-1">
              {visibleClues.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-800 px-3 py-8 text-center text-xs text-slate-600">
                  검색 결과가 없습니다.
                </p>
              ) : (
                visibleClues.map((clue) => (
                  <ClueOption
                    key={clue.id}
                    clue={clue}
                    selected={assignedSet.has(clue.id)}
                    disabled={updateConfig.isPending}
                    onAdd={addClue}
                  />
                ))
              )}
            </div>
          </section>
          <section className="rounded-lg border border-amber-500/20 bg-amber-950/10 p-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-300/80">
                이 장소의 단서
              </p>
              <span className="text-[10px] text-slate-600">클릭 추가</span>
            </div>
            {selectedClues.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-800 px-2.5 py-5 text-center text-xs text-slate-600">
                아직 배정된 단서가 없습니다. 좌측 목록에서 단서를 클릭하세요.
              </p>
            ) : (
              <div className="space-y-2">
                {selectedClues.map((clue) => (
                  <SelectedClue
                    key={clue.id}
                    clue={clue}
                    disabled={updateConfig.isPending}
                    onRemove={removeClue}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function ClueOption({
  clue,
  selected,
  disabled,
  onAdd,
}: {
  clue: ClueResponse;
  selected: boolean;
  disabled: boolean;
  onAdd: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onAdd(clue.id)}
      disabled={disabled || selected}
      aria-label={`${clue.name} 추가`}
      className="group flex w-full items-center gap-3 rounded-md border border-transparent px-2 py-2 text-left transition hover:border-amber-500/30 hover:bg-slate-800/80 disabled:cursor-default disabled:border-amber-500/10 disabled:bg-amber-950/10"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-800 text-[10px] font-semibold text-amber-400">
        {roundLabel(clue)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-200">{clue.name}</span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">{clueMeta(clue)}</span>
      </span>
      <span className="inline-flex h-7 shrink-0 items-center justify-center rounded-full border border-slate-700 px-2 text-[10px] font-semibold text-slate-500 group-hover:border-amber-500 group-hover:text-amber-300 group-disabled:border-amber-500/20 group-disabled:text-amber-300/70">
        {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}

function SelectedClue({
  clue,
  disabled,
  onRemove,
}: {
  clue: ClueResponse;
  disabled: boolean;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-slate-950/80 px-2.5 py-1.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-[9px] font-semibold text-amber-300">
        {roundLabel(clue)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-slate-200">{clue.name}</span>
        <span className="block truncate text-[10px] text-slate-600">{clueMeta(clue)}</span>
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onRemove(clue.id)}
        aria-label={`${clue.name} 제거`}
        className="rounded-full p-1 text-slate-600 hover:bg-red-950/40 hover:text-red-300 disabled:opacity-50"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function EmptyClues() {
  return (
    <div className="rounded-md border border-dashed border-slate-800 py-6 text-center">
      <Package className="mx-auto mb-2 h-5 w-5 text-slate-800" />
      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-700">
        단서가 없습니다
      </p>
    </div>
  );
}
