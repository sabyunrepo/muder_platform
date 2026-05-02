import { Plus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';

interface ClueItem {
  id: string;
  name: string;
  location?: string;
  round?: number;
  tag?: string;
}

interface StartingClueAssignerProps {
  characterName: string;
  clues: ClueItem[];
  selectedIds: string[];
  onClueToggle: (clueId: string, checked: boolean) => void;
  selectedTitle?: string;
}

function getClueMeta(clue: ClueItem) {
  return [clue.location, clue.tag].filter(Boolean).join(' · ');
}

function getRoundLabel(clue: ClueItem) {
  return typeof clue.round === 'number' ? `R${clue.round}` : 'CL';
}

export function StartingClueAssigner({
  characterName,
  clues,
  selectedIds,
  onClueToggle,
  selectedTitle,
}: StartingClueAssignerProps) {
  const [query, setQuery] = useState('');
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const normalizedQuery = query.trim().toLowerCase();
  const selectedClues = clues.filter((clue) => selectedSet.has(clue.id));
  const visibleClues = clues.filter((clue) => {
    if (!normalizedQuery) return true;
    const haystack = [clue.name, clue.location, clue.tag, clue.round?.toString()]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  if (clues.length === 0) {
    return <p className="text-xs text-slate-600">단서가 없습니다</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(13rem,0.55fr)]">
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
            placeholder="단서명, 장소, 태그 검색"
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
            visibleClues.map((clue) => {
              const isSelected = selectedSet.has(clue.id);
              const meta = getClueMeta(clue);
              return (
                <button
                  key={clue.id}
                  type="button"
                  onClick={() => onClueToggle(clue.id, true)}
                  disabled={isSelected}
                  className="group flex w-full items-center gap-3 rounded-md border border-transparent px-2 py-2 text-left transition hover:border-amber-500/30 hover:bg-slate-800/80 disabled:cursor-default disabled:border-amber-500/10 disabled:bg-amber-950/10"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-800 text-[10px] font-semibold text-amber-400">
                    {getRoundLabel(clue)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-200">
                      {clue.name}
                    </span>
                    {meta && (
                      <span className="mt-0.5 block truncate text-xs text-slate-500">{meta}</span>
                    )}
                  </span>
                  <span className="inline-flex h-7 shrink-0 items-center justify-center rounded-full border border-slate-700 px-2 text-[10px] font-semibold text-slate-500 transition group-hover:border-amber-500 group-hover:text-amber-300 group-disabled:border-amber-500/20 group-disabled:text-amber-300/70">
                    {isSelected ? '추가됨' : <Plus className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-lg border border-amber-500/20 bg-amber-950/10 p-2.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-300/80">
            {selectedTitle ?? `${characterName}의 시작 단서`}
          </p>
          <span className="text-[10px] text-slate-600">클릭 추가</span>
        </div>

        {selectedClues.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-800 px-2.5 py-5 text-center text-xs text-slate-600">
            아직 배정된 단서가 없습니다. 좌측 목록에서 단서를 클릭하세요.
          </p>
        ) : (
          <div className="space-y-2">
            {selectedClues.map((clue) => {
              const meta = getClueMeta(clue);
              return (
                <div
                  key={clue.id}
                  className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-slate-950/80 px-2.5 py-1.5"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-[9px] font-semibold text-amber-300">
                    {getRoundLabel(clue)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-slate-200">
                      {clue.name}
                    </span>
                    {meta && (
                      <span className="block truncate text-[10px] text-slate-600">{meta}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => onClueToggle(clue.id, false)}
                    aria-label={`${clue.name} 제거`}
                    className="rounded-full p-1 text-slate-600 hover:bg-red-950/40 hover:text-red-300"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
