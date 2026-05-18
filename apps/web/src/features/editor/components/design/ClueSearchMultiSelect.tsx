import { Check, Plus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';

export interface ClueSearchSelectItem {
  id: string;
  name: string;
  meta?: string;
  badge?: string;
}

interface ClueSearchMultiSelectProps<T extends ClueSearchSelectItem> {
  title: string;
  items: T[];
  selectedIds: string[];
  disabled?: boolean;
  activeId?: string | null;
  searchLabel: string;
  searchPlaceholder: string;
  emptySelectedText: string;
  idleSearchText: string;
  emptySearchText?: string;
  resultLimit?: number;
  getDisabledReason?: (item: T) => string | null | undefined;
  getAddAriaLabel?: (item: T) => string;
  getRemoveAriaLabel?: (item: T) => string;
  getSelectedAriaLabel?: (item: T) => string;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onSelectSelected?: (id: string) => void;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function ClueSearchMultiSelect<T extends ClueSearchSelectItem>({
  title,
  items,
  selectedIds,
  disabled = false,
  activeId,
  searchLabel,
  searchPlaceholder,
  emptySelectedText,
  idleSearchText,
  emptySearchText = '검색 결과가 없습니다.',
  resultLimit = 20,
  getDisabledReason,
  getAddAriaLabel,
  getRemoveAriaLabel,
  getSelectedAriaLabel,
  onAdd,
  onRemove,
  onSelectSelected,
}: ClueSearchMultiSelectProps<T>) {
  const [query, setQuery] = useState('');
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedItems = useMemo(
    () => items.filter((item) => selectedSet.has(item.id)),
    [items, selectedSet],
  );
  const normalizedQuery = normalize(query);
  const searchResults = useMemo(() => {
    if (!normalizedQuery) return [];
    return items
      .filter((item) =>
        [item.name, item.meta, item.badge]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery),
      )
      .slice(0, resultLimit);
  }, [items, normalizedQuery, resultLimit]);

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</p>
        <span className="text-[10px] text-slate-600">
          {selectedItems.length}/{items.length}개 선택
        </span>
      </div>

      {selectedItems.length === 0 ? (
        <p className="mb-3 rounded-md border border-dashed border-slate-800 px-3 py-5 text-center text-xs text-slate-600">
          {emptySelectedText}
        </p>
      ) : (
        <div className="mb-3 grid gap-1.5">
          {selectedItems.map((item) => (
            <SelectedClueRow
              key={item.id}
              item={item}
              active={activeId === item.id}
              disabled={disabled}
              removeLabel={getRemoveAriaLabel?.(item) ?? `${item.name} 제거`}
              selectLabel={getSelectedAriaLabel?.(item) ?? `${item.name} 선택`}
              onRemove={onRemove}
              onSelect={onSelectSelected}
            />
          ))}
        </div>
      )}

      <label className="relative block">
        <span className="sr-only">{searchLabel}</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchLabel}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        />
      </label>

      <div className="mt-3">
        {!normalizedQuery ? (
          <p className="rounded-md border border-dashed border-slate-800 px-3 py-5 text-center text-xs text-slate-600">
            {idleSearchText}
          </p>
        ) : searchResults.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-800 px-3 py-5 text-center text-xs text-slate-600">
            {emptySearchText}
          </p>
        ) : (
          <div className="space-y-1 pr-1 lg:max-h-72 lg:overflow-y-auto">
            {searchResults.map((item) => {
              const selected = selectedSet.has(item.id);
              const disabledReason = getDisabledReason?.(item);
              const itemDisabled = disabled || Boolean(disabledReason);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={itemDisabled && !selected}
                  aria-pressed={selected}
                  aria-label={
                    selected
                      ? (getSelectedAriaLabel?.(item) ?? `${item.name} 선택`)
                      : (getAddAriaLabel?.(item) ?? `${item.name} 추가`)
                  }
                  onClick={() => {
                    if (selected) onSelectSelected?.(item.id);
                    else onAdd(item.id);
                  }}
                  className={`group flex w-full items-center gap-3 rounded-md border px-2 py-2 text-left transition hover:border-amber-500/30 hover:bg-slate-800/80 disabled:cursor-default disabled:border-slate-800 disabled:bg-slate-950/40 ${
                    selected
                      ? 'border-amber-500/20 bg-amber-950/10'
                      : 'border-transparent'
                  }`}
                >
                  <ClueBadge item={item} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-200">
                      {item.name}
                    </span>
                    {item.meta && (
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {item.meta}
                      </span>
                    )}
                  </span>
                  <span className="inline-flex h-7 shrink-0 items-center justify-center rounded-full border border-slate-700 px-2 text-[10px] font-semibold text-slate-500 transition group-hover:border-amber-500 group-hover:text-amber-300">
                    {selected ? (
                      <>
                        <Check className="mr-1 h-3.5 w-3.5" />
                        선택됨
                      </>
                    ) : disabledReason ? (
                      disabledReason
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function SelectedClueRow<T extends ClueSearchSelectItem>({
  item,
  active,
  disabled,
  removeLabel,
  selectLabel,
  onRemove,
  onSelect,
}: {
  item: T;
  active: boolean;
  disabled: boolean;
  removeLabel: string;
  selectLabel: string;
  onRemove: (id: string) => void;
  onSelect?: (id: string) => void;
}) {
  const content = (
    <>
      <ClueBadge item={item} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-xs font-medium text-slate-200">{item.name}</span>
        {item.meta && (
          <span className="block truncate text-[10px] text-slate-600">{item.meta}</span>
        )}
      </span>
    </>
  );

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
        active ? 'border-amber-400/50 bg-amber-500/10' : 'border-amber-500/20 bg-slate-950/80'
      }`}
    >
      {onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(item.id)}
          aria-label={selectLabel}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          {content}
        </button>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2">{content}</span>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onRemove(item.id)}
        aria-label={removeLabel}
        className="rounded-full p-1 text-slate-600 hover:bg-red-950/40 hover:text-red-300 disabled:opacity-50"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function ClueBadge<T extends ClueSearchSelectItem>({ item }: { item: T }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-800 text-[10px] font-semibold text-amber-400">
      {item.badge ?? 'CL'}
    </span>
  );
}
