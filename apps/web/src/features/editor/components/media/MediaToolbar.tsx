import { Plus, Search, Trash2, Upload, Youtube } from "lucide-react";
import type { MediaCategoryResponse, MediaType } from "@/features/editor/mediaApi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MediaFilter = MediaType | "all";

export interface MediaToolbarProps {
  filter: MediaFilter;
  onFilterChange: (f: MediaFilter) => void;
  categories: MediaCategoryResponse[];
  categoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onCreateCategory: () => void;
  onDeleteCategory: () => void;
  onUploadClick: () => void;
  onYouTubeClick: () => void;
}

const PILLS: Array<{ value: MediaFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "BGM", label: "BGM" },
  { value: "SFX", label: "효과음" },
  { value: "VOICE", label: "음성" },
  { value: "VIDEO", label: "비디오" },
  { value: "DOCUMENT", label: "문서" },
  { value: "IMAGE", label: "이미지" },
];

// ---------------------------------------------------------------------------
// MediaToolbar
// ---------------------------------------------------------------------------

export function MediaToolbar({
  filter,
  onFilterChange,
  categories,
  categoryId,
  onCategoryChange,
  searchQuery,
  onSearchQueryChange,
  onCreateCategory,
  onDeleteCategory,
  onUploadClick,
  onYouTubeClick,
}: MediaToolbarProps) {
  return (
    <div
      className="flex shrink-0 flex-col gap-3 border-b border-slate-800 bg-slate-950 px-4 py-3"
      role="toolbar"
      aria-label="미디어 도구 모음"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div
            className="flex gap-1.5 overflow-x-auto pb-1"
            role="group"
            aria-label="미디어 카테고리 필터"
          >
            <button
              type="button"
              onClick={() => onCategoryChange(null)}
              aria-pressed={categoryId == null}
              className={`h-7 rounded-sm border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 ${
                categoryId == null
                  ? "border-amber-500 bg-amber-500/10 text-amber-300"
                  : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
              }`}
            >
              전체
            </button>
            {categories.map((category) => {
              const isActive = categoryId === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => onCategoryChange(category.id)}
                  aria-pressed={isActive}
                  className={`h-7 shrink-0 rounded-sm border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 ${
                    isActive
                      ? "border-amber-500 bg-amber-500/10 text-amber-300"
                      : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                  }`}
                >
                  {category.name}
                </button>
              );
            })}
            <button
              type="button"
              onClick={onCreateCategory}
              className="flex h-7 shrink-0 items-center gap-1 rounded-sm border border-slate-700 px-2.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
            >
              <Plus className="h-3.5 w-3.5" />
              카테고리
            </button>
            {categoryId && (
              <button
                type="button"
                onClick={onDeleteCategory}
                className="flex h-7 shrink-0 items-center gap-1 rounded-sm border border-rose-900/80 px-2.5 text-xs font-medium text-rose-300 transition-colors hover:border-rose-500 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                카테고리 삭제
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative min-w-0 sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="이름, 태그로 검색"
              aria-label="미디어 검색"
              className="h-8 w-full rounded-sm border border-slate-700 bg-slate-950 pl-8 pr-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onUploadClick}
              className="flex h-8 items-center gap-1.5 rounded-sm border border-slate-700 px-3 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
            >
              <Upload className="h-3.5 w-3.5" />
              파일 업로드
            </button>
            <button
              type="button"
              onClick={onYouTubeClick}
              className="flex h-8 items-center gap-1.5 rounded-sm border border-slate-700 px-3 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
            >
              <Youtube className="h-3.5 w-3.5" />
              YouTube
            </button>
          </div>
        </div>
      </div>

      <div
        className="flex gap-1.5 overflow-x-auto pb-1"
        role="group"
        aria-label="미디어 타입 필터"
      >
        {PILLS.map((pill) => {
          const isActive = filter === pill.value;
          return (
            <button
              key={pill.value}
              type="button"
              onClick={() => onFilterChange(pill.value)}
              aria-pressed={isActive}
              className={`h-7 shrink-0 rounded-sm border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 ${
                isActive
                  ? "border-amber-500 bg-amber-500/10 text-amber-300"
                  : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
