import { Search, UserRound } from "lucide-react";

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
    <label className="flex flex-col gap-1 text-[11px] text-slate-400">
      {label}
      <span className="flex items-center gap-2 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/40">
        <Search className="h-3.5 w-3.5 text-slate-400" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
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
    <div className="rounded border border-slate-800 bg-slate-950/70 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-400">{title}</span>
        {selectedItems.length > 0 && (
          <span className="text-[10px] text-amber-300">{selectedItems.length}개 선택</span>
        )}
      </div>
      {selectedItems.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedItems.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] text-amber-100"
            >
              {single ? <UserRound className="h-3 w-3" /> : null}
              {item.name}
            </span>
          ))}
        </div>
      )}
      {items.length === 0 ? (
        <p className="px-2 py-3 text-center text-xs text-slate-400">{emptyText}</p>
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
                className={`flex min-h-10 items-center justify-between gap-2 rounded px-2 py-2 text-left text-xs transition-colors ${
                  selected
                    ? "bg-amber-500/15 text-amber-100 ring-1 ring-amber-500/40"
                    : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.name}</span>
                  {item.summary && (
                    <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                      {item.summary}
                    </span>
                  )}
                </span>
                {meta && <span className="shrink-0 text-[10px] text-slate-400">{meta}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
