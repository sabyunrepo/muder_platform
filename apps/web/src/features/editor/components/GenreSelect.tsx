import { Spinner } from "@/shared/components/ui/Spinner";
import { useTemplates } from "@/features/editor/templateApi";
import { useThemeStore } from "@/stores/themeStore";

// ---------------------------------------------------------------------------
// GenreSelect
// ---------------------------------------------------------------------------

export function GenreSelect() {
  const { data: templates, isLoading, isError } = useTemplates();
  const { selectedGenre, setGenre } = useThemeStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (isError || !templates) {
    return (
      <p className="text-sm text-red-400">템플릿 목록을 불러올 수 없습니다.</p>
    );
  }

  const genres = Array.from(new Set(templates.map((t) => t.genre))).sort();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
        장르 선택
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {genres.map((genre) => {
          const isSelected = selectedGenre === genre;
          return (
            <button
              key={genre}
              type="button"
              onClick={() => setGenre(isSelected ? null : genre)}
              className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
                isSelected
                  ? "border-amber-500 bg-amber-500/10 text-amber-300"
                  : "border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-500 hover:bg-slate-800"
              }`}
            >
              {genre}
            </button>
          );
        })}
      </div>
    </div>
  );
}
