import {
  FileAudio,
  Image,
  FileText,
  Film,
  Mic,
  Music,
  Search,
  Sparkles,
  X,
  Youtube,
} from "lucide-react";

import type {
  MediaResourceViewModel,
} from "@/features/editor/entities/mediaResource/mediaResourceAdapter";
import type { MediaCategoryResponse, MediaType } from "@/features/editor/mediaApi";

export interface PickerMediaResource extends MediaResourceViewModel {
  thumbnailUrl?: string | null;
}

export interface ResourcePickerProps {
  title: string;
  resources: PickerMediaResource[];
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onClose: () => void;
  onSelect: (resourceId: string) => void;
  categories?: MediaCategoryResponse[];
  categoryId?: string | null;
  onCategoryChange?: (categoryId: string | null) => void;
  onUploadClick?: () => void;
  selectedId?: string | null;
  isLoading?: boolean;
  emptyLabel?: string;
  searchEmptyLabel?: string;
  filterHint?: string | null;
}

function MediaTypeIcon({ type }: { type: MediaType }) {
  switch (type) {
    case "BGM":
      return <Music className="h-5 w-5 text-amber-400" />;
    case "SFX":
      return <Sparkles className="h-5 w-5 text-cyan-400" />;
    case "VOICE":
      return <Mic className="h-5 w-5 text-emerald-400" />;
    case "VIDEO":
      return <Film className="h-5 w-5 text-rose-400" />;
    case "DOCUMENT":
      return <FileText className="h-5 w-5 text-violet-400" />;
    case "IMAGE":
      return <Image className="h-5 w-5 text-teal-400" />;
    default:
      return <FileAudio className="h-5 w-5 text-slate-400" />;
  }
}

export function ResourcePicker({
  title,
  resources,
  searchQuery,
  onSearchQueryChange,
  onClose,
  onSelect,
  categories = [],
  categoryId = null,
  onCategoryChange,
  onUploadClick,
  selectedId,
  isLoading = false,
  emptyLabel = "리소스가 없습니다",
  searchEmptyLabel = "검색 결과가 없습니다",
  filterHint,
}: ResourcePickerProps) {
  const hasQuery = searchQuery.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-2xl shadow-black/40 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
            <p className="mt-1 text-xs text-slate-400">
              제작에 필요한 리소스만 검색하고 선택하세요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-3 flex flex-col gap-2">
          {onCategoryChange ? (
            <div
              className="flex gap-1.5 overflow-x-auto pb-1"
              role="group"
              aria-label="미디어 카테고리 필터"
            >
              <button
                type="button"
                onClick={() => onCategoryChange(null)}
                aria-pressed={categoryId == null}
                className={`h-7 shrink-0 rounded-sm border px-3 text-xs font-medium ${
                  categoryId == null
                    ? "border-amber-500 bg-amber-500/10 text-amber-300"
                    : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                }`}
              >
                전체
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => onCategoryChange(category.id)}
                  aria-pressed={categoryId === category.id}
                  className={`h-7 shrink-0 rounded-sm border px-3 text-xs font-medium ${
                    categoryId === category.id
                      ? "border-amber-500 bg-amber-500/10 text-amber-300"
                      : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                className="w-full rounded-sm border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
                placeholder="이름, 태그, 종류로 검색"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                aria-label="미디어 이름 검색"
              />
            </label>
            {onUploadClick ? (
              <button
                type="button"
                onClick={onUploadClick}
                className="h-10 shrink-0 rounded-sm border border-slate-700 px-3 text-sm font-medium text-slate-200 transition-colors hover:border-slate-500 hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
              >
                바로 업로드
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {isLoading ? (
            <div
              className="py-8 text-center text-sm text-slate-400"
              role="status"
            >
              불러오는 중...
            </div>
          ) : resources.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              {hasQuery ? searchEmptyLabel : emptyLabel}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {resources.map((resource) => {
                const isSelected = selectedId === resource.id;
                const thumbnailUrl = resource.thumbnailUrl;
                return (
                  <div key={resource.id} role="listitem">
                    <button
                      type="button"
                      onClick={() => {
                        if (resource.isSelectable) onSelect(resource.id);
                      }}
                      disabled={!resource.isSelectable}
                      aria-pressed={isSelected}
                      className={`flex h-full w-full flex-col overflow-hidden rounded-sm border text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        isSelected
                          ? "border-amber-500/50 bg-amber-500/15"
                          : "border-slate-800 bg-slate-950 hover:border-slate-700 hover:bg-slate-800"
                      }`}
                    >
                      <div className="relative flex aspect-[4/3] w-full items-center justify-center bg-slate-950/80">
                        {thumbnailUrl ? (
                          <img
                            src={thumbnailUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <MediaTypeIcon type={resource.type} />
                        )}
                        {resource.isExternal ? (
                          <span className="absolute left-2 top-2 rounded-sm bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                            YouTube
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0 px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-sm font-medium text-slate-100">{resource.name}</p>
                          {resource.isExternal ? (
                            <Youtube className="h-4 w-4 shrink-0 text-rose-500" aria-label="YouTube" />
                          ) : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                          {resource.unselectableReason ?? resource.metaLabel}
                        </p>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {filterHint ? (
          <p className="mt-3 text-xs text-slate-500">{filterHint}</p>
        ) : null}
      </div>
    </div>
  );
}
