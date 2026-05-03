import { useMemo, useState, type ReactNode } from 'react';
import { Plus, Search } from 'lucide-react';

export interface EntityEditorShellProps<TItem> {
  title: string;
  items: TItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onCreate?: () => void;
  createLabel?: string;
  emptyMessage?: string;
  emptyDescription?: string;
  listAccessory?: ReactNode;
  getItemId: (item: TItem) => string;
  getItemTitle: (item: TItem) => string;
  getItemDescription?: (item: TItem) => string;
  getItemBadges?: (item: TItem) => string[];
  renderItemActions?: (item: TItem) => ReactNode;
  renderDetail: (item: TItem) => ReactNode;
  renderInspector?: (item: TItem) => ReactNode;
}

export function EntityEditorShell<TItem>({
  title,
  items,
  selectedId,
  onSelect,
  onCreate,
  createLabel,
  emptyMessage,
  emptyDescription,
  listAccessory,
  getItemId,
  getItemTitle,
  getItemDescription,
  getItemBadges,
  renderItemActions,
  renderDetail,
  renderInspector,
}: EntityEditorShellProps<TItem>) {
  const [query, setQuery] = useState('');
  const selected = items.find((item) => getItemId(item) === selectedId) ?? items[0];
  const visibleItems = useMemo(
    () => filterItems(items, query, getItemTitle, getItemDescription, getItemBadges),
    [items, query, getItemTitle, getItemDescription, getItemBadges],
  );

  const actionLabel = createLabel ?? `${title} 추가`;

  if (!selected) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-8 text-center">
        <p className="text-sm font-semibold text-slate-300">{emptyMessage ?? `아직 ${title}가 없습니다`}</p>
        <p className="mt-1 text-xs text-slate-500">{emptyDescription ?? `새 ${title}를 추가해 제작을 시작하세요.`}</p>
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            aria-label={actionLabel}
            className="mt-5 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/20"
          >
            <Plus className="h-4 w-4" />{actionLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(16rem,0.85fr)_minmax(0,1.45fr)]">
      <section aria-label={`${title} 목록`} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <header className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">{title} 목록</h3>
            <p className="text-xs text-slate-600">{items.length}개의 {title}</p>
          </div>
          {onCreate && (
            <button
              type="button"
              onClick={onCreate}
              aria-label={actionLabel}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
            >
              <Plus className="h-3.5 w-3.5" />{actionLabel}
            </button>
          )}
        </header>
        {listAccessory}
        <label className="relative mb-3 block">
          <span className="sr-only">{title} 검색</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`${title}명, 설명 검색`}
            aria-label={`${title} 검색`}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2.5 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
          />
        </label>
        <div className="max-h-[34rem] space-y-2 overflow-auto pr-1">
          {visibleItems.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-800 px-3 py-8 text-center text-xs text-slate-600">
              검색 결과가 없습니다.
            </p>
          ) : (
            visibleItems.map((item) => {
              const id = getItemId(item);
              return (
                <EntityListItem
                  key={id}
                  active={id === getItemId(selected)}
                  title={getItemTitle(item)}
                  description={getItemDescription?.(item)}
                  badges={getItemBadges?.(item) ?? []}
                  actions={renderItemActions?.(item)}
                  onSelect={() => onSelect(id)}
                />
              );
            })
          )}
        </div>
      </section>

      <section className="space-y-4" aria-label={`${title} 상세 영역`}>
        {renderDetail(selected)}
        {renderInspector?.(selected)}
      </section>
    </div>
  );
}

function EntityListItem({
  active,
  title,
  description,
  badges,
  actions,
  onSelect,
}: {
  active: boolean;
  title: string;
  description?: string;
  badges: string[];
  actions?: ReactNode;
  onSelect: () => void;
}) {
  const content = (
    <>
      <span className="block truncate text-sm font-semibold text-slate-200">{title}</span>
      {description && <span className="mt-1 block truncate text-xs text-slate-500">{description}</span>}
      {badges.length > 0 && (
        <span className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-medium">
          {badges.map((badge) => (
            <span key={badge} className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-slate-400">
              {badge}
            </span>
          ))}
        </span>
      )}
    </>
  );

  if (actions) {
    return (
      <div
        className={`group flex items-stretch gap-2 rounded-lg border p-2 transition ${
          active
            ? 'border-amber-500/50 bg-amber-500/10'
            : 'border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-900'
        }`}
      >
        <button type="button" aria-label={`${title} 선택`} onClick={onSelect} className="min-w-0 flex-1 p-1 text-left">
          {content}
        </button>
        <div className="flex shrink-0 items-start" onClick={(event) => event.stopPropagation()}>
          {actions}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={`${title} 선택`}
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition ${
        active
          ? 'border-amber-500/50 bg-amber-500/10'
          : 'border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-900'
      }`}
    >
      {content}
    </button>
  );
}

function filterItems<TItem>(
  items: TItem[],
  query: string,
  getItemTitle: (item: TItem) => string,
  getItemDescription?: (item: TItem) => string,
  getItemBadges?: (item: TItem) => string[],
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) =>
    [getItemTitle(item), getItemDescription?.(item), ...(getItemBadges?.(item) ?? [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(normalized),
  );
}
