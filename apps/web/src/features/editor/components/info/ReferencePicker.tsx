export function ReferencePicker({
  title,
  items,
  selectedIds,
  onToggle,
}: {
  title: string;
  items: { id: string; name: string }[];
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
}) {
  return (
    <fieldset className="rounded border border-slate-800 p-3">
      <legend className="px-1 text-xs font-medium text-slate-300">{title}</legend>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">연결할 항목이 없습니다</p>
      ) : (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={selectedIds.includes(item.id)}
                onChange={(event) => onToggle(item.id, event.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900"
              />
              <span className="truncate">{item.name}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
