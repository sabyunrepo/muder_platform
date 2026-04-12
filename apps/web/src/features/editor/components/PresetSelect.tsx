import { Spinner } from "@/shared/components/ui/Spinner";
import { useTemplates } from "@/features/editor/templateApi";
import { useThemeStore } from "@/stores/themeStore";

// ---------------------------------------------------------------------------
// PresetSelect
// ---------------------------------------------------------------------------

export function PresetSelect() {
  const { data: templates, isLoading, isError } = useTemplates();
  const { selectedGenre, selectedPresetId, setPreset } = useThemeStore();

  if (!selectedGenre) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (isError || !templates) {
    return (
      <p className="text-sm text-red-400">프리셋 목록을 불러올 수 없습니다.</p>
    );
  }

  const filtered = templates.filter((t) => t.genre === selectedGenre);

  if (filtered.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        이 장르에 사용 가능한 프리셋이 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
        프리셋 선택
      </h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {filtered.map((template) => {
          const isSelected = selectedPresetId === template.id;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => setPreset(isSelected ? null : template.id)}
              className={`rounded-lg border p-4 text-left transition-colors ${
                isSelected
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-slate-700 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800"
              }`}
            >
              <span
                className={`block text-sm font-semibold ${
                  isSelected ? "text-amber-300" : "text-slate-200"
                }`}
              >
                {template.name}
              </span>
              {template.description && (
                <span className="mt-1 block text-xs text-slate-400">
                  {template.description}
                </span>
              )}
              <span className="mt-2 block text-xs text-slate-500">
                {template.min_players}–{template.max_players}인 ·{" "}
                {template.duration_min}분
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
