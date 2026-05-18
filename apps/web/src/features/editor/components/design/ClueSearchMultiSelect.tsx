import { Check, Plus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { editorDesignClassNames } from '@/features/editor/design-system/editorDesignTokens';

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
    <section className={`p-3 ${editorDesignClassNames.subtlePanel}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--mmp-editor-color-slate)]">{title}</p>
        <span className="text-[10px] text-[var(--mmp-editor-color-steel)]">
          {selectedItems.length}/{items.length}개 선택
        </span>
      </div>

      {selectedItems.length === 0 ? (
        <p className="mb-3 rounded-md border border-dashed border-[var(--mmp-editor-color-hairline)] px-3 py-5 text-center text-xs text-[var(--mmp-editor-color-slate)]">
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
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--mmp-editor-color-steel)]" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchLabel}
          className={`w-full py-2 pl-9 pr-3 text-sm ${editorDesignClassNames.input}`}
        />
      </label>

      <div className="mt-3">
        {!normalizedQuery ? (
          <p className="rounded-md border border-dashed border-[var(--mmp-editor-color-hairline)] px-3 py-5 text-center text-xs text-[var(--mmp-editor-color-slate)]">
            {idleSearchText}
          </p>
        ) : searchResults.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--mmp-editor-color-hairline)] px-3 py-5 text-center text-xs text-[var(--mmp-editor-color-slate)]">
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
                  className={`group flex w-full items-center gap-3 rounded-md border px-2 py-2 text-left transition hover:border-[var(--mmp-editor-color-hairline-strong)] hover:bg-[var(--mmp-editor-color-surface)] disabled:cursor-default disabled:opacity-60 ${
                    selected
                      ? 'border-[var(--mmp-editor-color-primary)] bg-[var(--mmp-editor-color-tint-lavender)]'
                      : 'border-transparent'
                  }`}
                >
                  <ClueBadge item={item} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--mmp-editor-color-charcoal)]">
                      {item.name}
                    </span>
                    {item.meta && (
                      <span className="mt-0.5 block truncate text-xs text-[var(--mmp-editor-color-slate)]">
                        {item.meta}
                      </span>
                    )}
                  </span>
                  <span className="inline-flex h-7 shrink-0 items-center justify-center rounded-full border border-[var(--mmp-editor-color-hairline)] px-2 text-[10px] font-semibold text-[var(--mmp-editor-color-steel)] transition group-hover:border-[var(--mmp-editor-color-primary)] group-hover:text-[var(--mmp-editor-color-primary)]">
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
        <span className="block truncate text-xs font-medium text-[var(--mmp-editor-color-charcoal)]">{item.name}</span>
        {item.meta && (
          <span className="block truncate text-[10px] text-[var(--mmp-editor-color-slate)]">{item.meta}</span>
        )}
      </span>
    </>
  );

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
        active
          ? 'border-[var(--mmp-editor-color-primary)] bg-[var(--mmp-editor-color-tint-lavender)]'
          : 'border-[var(--mmp-editor-color-hairline)] bg-[var(--mmp-editor-color-canvas)]'
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
        className={`p-1 hover:text-[var(--mmp-editor-color-error)] disabled:opacity-50 ${editorDesignClassNames.iconButton}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function ClueBadge<T extends ClueSearchSelectItem>({ item }: { item: T }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--mmp-editor-color-tint-yellow)] text-[10px] font-semibold text-[var(--mmp-editor-color-warning)]">
      {item.badge ?? 'CL'}
    </span>
  );
}
