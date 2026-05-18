import { Search, UserRound } from "lucide-react";
import { editorDesignClassNames } from "@/features/editor/design-system/editorDesignTokens";

export interface OptionItem {
  id: string;
  name: string;
  summary?: string;
  groupLabel?: string;
}

interface SearchFieldProps {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}

export function SearchField({ label, value, placeholder, onChange }: SearchFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-[var(--mmp-editor-color-slate)]">
      {label}
      <span className={`flex items-center gap-2 px-2 py-1.5 ${editorDesignClassNames.input}`}>
        <Search className="h-3.5 w-3.5 text-[var(--mmp-editor-color-slate)]" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-xs text-[var(--mmp-editor-color-ink)] placeholder:text-[var(--mmp-editor-color-muted)] focus:outline-none"
        />
      </span>
    </label>
  );
}

interface OptionListProps<T extends OptionItem> {
  title: string;
  emptyText: string;
  items: T[];
  allItems?: T[];
  selectedIds: string[];
  single?: boolean;
  getMeta: (item: T) => string | undefined;
  onToggle: (id: string) => void;
}

export function OptionList<T extends OptionItem>({
  title,
  emptyText,
  items,
  allItems,
  selectedIds,
  single = false,
  getMeta,
  onToggle,
}: OptionListProps<T>) {
  const selectedItems = (allItems ?? items).filter((item) => selectedIds.includes(item.id));

  return (
    <div className={`p-2 ${editorDesignClassNames.subtlePanel}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-[var(--mmp-editor-color-slate)]">{title}</span>
        {selectedItems.length > 0 && (
          <span className="text-[10px] text-[var(--mmp-editor-color-primary)]">{selectedItems.length}개 선택</span>
        )}
      </div>
      {selectedItems.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedItems.map((item) => (
            <span
              key={item.id}
              className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] ${editorDesignClassNames.tag}`}
            >
              {single ? <UserRound className="h-3 w-3" /> : null}
              {item.name}
            </span>
          ))}
        </div>
      )}
      {items.length === 0 ? (
        <p className="px-2 py-3 text-center text-xs text-[var(--mmp-editor-color-slate)]">{emptyText}</p>
      ) : (
        <div className="grid max-h-44 gap-1 overflow-y-auto pr-1">
          {items.map((item) => {
            const selected = selectedIds.includes(item.id);
            const meta = getMeta(item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggle(item.id)}
                aria-pressed={selected}
                className={`flex min-h-10 items-center justify-between gap-2 px-2 py-2 text-left text-xs transition-colors ${
                  selected
                    ? editorDesignClassNames.listItemActive
                    : editorDesignClassNames.listItem
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.name}</span>
                  {item.summary && (
                    <span className="mt-0.5 block truncate text-[10px] text-[var(--mmp-editor-color-slate)]">
                      {item.summary}
                    </span>
                  )}
                </span>
                {meta && <span className="shrink-0 text-[10px] text-[var(--mmp-editor-color-slate)]">{meta}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
