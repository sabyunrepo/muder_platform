import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Plus, Search } from 'lucide-react';
import { editorDesignClassNames } from '@/features/editor/design-system/editorDesignTokens';

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
  getItemSearchText?: (item: TItem) => string;
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
  getItemSearchText,
  getItemBadges,
  renderItemActions,
  renderDetail,
  renderInspector,
}: EntityEditorShellProps<TItem>) {
  const [query, setQuery] = useState('');
  const visibleItems = useMemo(
    () => filterItems(items, query, getItemTitle, getItemDescription, getItemSearchText, getItemBadges),
    [items, query, getItemTitle, getItemDescription, getItemSearchText, getItemBadges],
  );

  const selected = visibleItems.find((item) => getItemId(item) === selectedId) ?? visibleItems[0];
  const selectedItemId = selected ? getItemId(selected) : undefined;
  const actionLabel = createLabel ?? `${title} 추가`;

  useEffect(() => {
    if (!selectedId || items.length === 0) return;
    const selectedExists = items.some((item) => getItemId(item) === selectedId);
    if (!selectedExists) {
      onSelect(getItemId(items[0]));
    }
  }, [getItemId, items, onSelect, selectedId]);

  if (items.length === 0) {
    return (
      <div className={`h-full min-h-0 border border-dashed p-8 text-center ${editorDesignClassNames.panel}`}>
        <p className="text-sm font-semibold text-[var(--mmp-editor-color-charcoal)]">{emptyMessage ?? `아직 ${title}가 없습니다`}</p>
        <p className={`mt-1 text-xs ${editorDesignClassNames.mutedText}`}>{emptyDescription ?? `새 ${title}를 추가해 제작을 시작하세요.`}</p>
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            aria-label={actionLabel}
            className={`mt-5 inline-flex min-h-10 items-center gap-1.5 px-4 py-2 ${editorDesignClassNames.primaryAction}`}
          >
            <Plus className="h-4 w-4" />{actionLabel}
          </button>
        )}
        {listAccessory && (
          <div className="mx-auto mt-4 w-full max-w-sm text-left">
            {listAccessory}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto lg:grid lg:grid-cols-[minmax(14rem,0.72fr)_minmax(0,1.9fr)] lg:overflow-hidden">
      <section
        aria-label={`${title} 목록`}
        className={`flex min-h-0 shrink-0 flex-col p-3 ${editorDesignClassNames.panel}`}
      >
        <header className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--mmp-editor-color-charcoal)]">{title} 목록</h3>
            <p className="text-xs text-[var(--mmp-editor-color-steel)]">{items.length}개의 {title}</p>
          </div>
          {onCreate && (
            <button
              type="button"
              onClick={onCreate}
              aria-label={actionLabel}
              className={`inline-flex min-h-9 items-center gap-1.5 px-3 py-2 text-xs ${editorDesignClassNames.primaryAction}`}
            >
              <Plus className="h-3.5 w-3.5" />{actionLabel}
            </button>
          )}
        </header>
        {listAccessory}
        <label className="relative mb-3 block">
          <span className="sr-only">{title} 검색</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--mmp-editor-color-steel)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`${title}명, 설명 검색`}
            aria-label={`${title} 검색`}
            className="w-full rounded-lg border border-[var(--mmp-editor-color-hairline)] bg-[var(--mmp-editor-color-surface-soft)] py-2.5 pl-9 pr-3 text-sm text-[var(--mmp-editor-color-charcoal)] placeholder:text-[var(--mmp-editor-color-steel)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mmp-editor-color-primary)]"
          />
        </label>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {visibleItems.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--mmp-editor-color-hairline)] px-3 py-8 text-center text-xs text-[var(--mmp-editor-color-steel)]">
              검색 결과가 없습니다.
            </p>
          ) : (
            visibleItems.map((item) => {
              const id = getItemId(item);
              return (
                <EntityListItem
                  key={id}
                  active={id === selectedItemId}
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

      {selected && (
        <section
          className="min-h-0 shrink-0 overflow-y-visible lg:overflow-y-auto lg:pr-2"
          aria-label={`${title} 상세 영역`}
        >
          <div className="space-y-4 pb-4">
            {renderDetail(selected)}
            {renderInspector?.(selected)}
          </div>
        </section>
      )}
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
      <span className="flex min-w-0 items-center gap-2">
        <span className="block truncate text-sm font-semibold text-[var(--mmp-editor-color-charcoal)]">{title}</span>
        {active && (
          <span className={`shrink-0 px-2 py-0.5 text-[10px] ${editorDesignClassNames.tag}`}>
            선택됨
          </span>
        )}
      </span>
      {description && <span className="mt-1 block truncate text-xs text-[var(--mmp-editor-color-steel)]">{description}</span>}
      {badges.length > 0 && (
        <span className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-medium">
          {badges.map((badge) => (
            <span key={badge} className={`px-2 py-0.5 ${editorDesignClassNames.tag}`}>
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
        className={`group flex items-stretch gap-2 p-2 transition ${editorDesignClassNames.listItem} ${
          active
            ? editorDesignClassNames.listItemActive
            : ''
        }`}
      >
        <button
          type="button"
          aria-label={`${title} 선택`}
          aria-pressed={active}
          onClick={onSelect}
          className="min-w-0 flex-1 p-1 text-left"
        >
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
      aria-pressed={active}
      onClick={onSelect}
      className={`w-full p-3 text-left transition ${editorDesignClassNames.listItem} ${
        active
          ? editorDesignClassNames.listItemActive
          : ''
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
  getItemSearchText?: (item: TItem) => string,
  getItemBadges?: (item: TItem) => string[],
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) =>
    [
      getItemTitle(item),
      getItemDescription?.(item),
      getItemSearchText?.(item),
      ...(getItemBadges?.(item) ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(normalized),
  );
}
