import { useMemo, useState } from "react";
import { Spinner } from "@/shared/components/ui";
import {
  useCreateMediaCategory,
  useDeleteMediaCategory,
  useMediaCategories,
  useMediaList,
  type MediaResponse,
  type MediaType,
} from "@/features/editor/mediaApi";
import { MediaToolbar, type MediaFilter } from "./MediaToolbar";
import { MediaCard } from "./MediaCard";
import { MediaDetail } from "./MediaDetail";
import { MediaUploadModal } from "./MediaUploadModal";
import { YouTubeAddModal } from "./YouTubeAddModal";
import { usePreviewPlayer } from "./usePreviewPlayer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MediaTabProps {
  themeId: string;
}

// ---------------------------------------------------------------------------
// MediaTab
// ---------------------------------------------------------------------------

export function MediaTab({ themeId }: MediaTabProps) {
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Modal state.
  const [uploadOpen, setUploadOpen] = useState(false);
  const [youtubeOpen, setYoutubeOpen] = useState(false);

  const queryType: MediaType | undefined =
    filter === "all" ? undefined : filter;

  const { data: categories = [] } = useMediaCategories(themeId);
  const createCategoryMutation = useCreateMediaCategory(themeId);
  const deleteCategoryMutation = useDeleteMediaCategory(themeId);
  const { data: mediaList, isLoading, isError } = useMediaList(
    themeId,
    queryType,
    categoryId ?? undefined,
  );
  const media: MediaResponse[] = useMemo(() => {
    const list = mediaList ?? [];
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return list;
    return list.filter((item) =>
      [item.name, item.type, item.source_type, ...item.tags]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [mediaList, searchQuery]);
  const selected = media.find((m) => m.id === selectedId) ?? null;

  const { playingId, toggle: togglePreview, stop: stopPreview } = usePreviewPlayer();

  const handleFilterChange = (next: MediaFilter) => {
    setFilter(next);
    setSelectedId(null);
    stopPreview();
  };

  const handleCategoryChange = (nextCategoryId: string | null) => {
    setCategoryId(nextCategoryId);
    setSelectedId(null);
    stopPreview();
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setSelectedId(null);
    stopPreview();
  };

  const handleCreateCategory = () => {
    const name = window.prompt("새 미디어 카테고리 이름을 입력하세요")?.trim();
    if (!name) return;
    createCategoryMutation.mutate({
      name,
      sort_order: categories.length + 1,
    });
  };

  const handleDeleteCategory = () => {
    if (!categoryId) return;
    const category = categories.find((item) => item.id === categoryId);
    const ok = window.confirm(
      `"${category?.name ?? "선택한 카테고리"}" 카테고리를 삭제하시겠습니까? 연결된 미디어는 전체 카테고리로 이동합니다.`,
    );
    if (!ok) return;
    deleteCategoryMutation.mutate(categoryId, {
      onSuccess: () => {
        setCategoryId(null);
        setSelectedId(null);
        stopPreview();
      },
    });
  };

  const handleClose = () => {
    setSelectedId(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <MediaToolbar
        filter={filter}
        onFilterChange={handleFilterChange}
        categories={categories}
        categoryId={categoryId}
        onCategoryChange={handleCategoryChange}
        searchQuery={searchQuery}
        onSearchQueryChange={handleSearchChange}
        onCreateCategory={handleCreateCategory}
        onDeleteCategory={handleDeleteCategory}
        onUploadClick={() => setUploadOpen(true)}
        onYouTubeClick={() => setYoutubeOpen(true)}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row lg:overflow-hidden">
        {/* List */}
        <div className="min-h-0 flex-1 overflow-visible lg:overflow-y-auto">
          {isLoading ? (
            <div
              className="flex h-full items-center justify-center"
              role="status"
              aria-label="미디어 로딩 중"
            >
              <Spinner />
            </div>
          ) : isError ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs text-rose-400">미디어 목록을 불러오지 못했습니다</p>
            </div>
          ) : media.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-xs font-mono uppercase tracking-widest text-slate-700">
                  미디어 없음
                </p>
                {searchQuery.trim() && (
                  <p className="mt-2 text-xs text-slate-500">검색어나 필터를 조정해 보세요</p>
                )}
              </div>
            </div>
          ) : (
            <div
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
              role="list"
              aria-label="미디어 목록"
            >
              {media.map((m) => (
                <div role="listitem" key={m.id}>
                  <MediaCard
                    media={m}
                    selected={selectedId === m.id}
                    onClick={() => setSelectedId(m.id)}
                    isPreviewPlaying={playingId === m.id}
                    onPreviewToggle={() => {
                      if (m.url) togglePreview(m.id, m.url);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        {selected && (
          <aside className="min-h-0 w-full shrink-0 border-t border-slate-800 pt-4 lg:w-96 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
            <MediaDetail media={selected} themeId={themeId} onClose={handleClose} />
          </aside>
        )}
      </div>

      <MediaUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        themeId={themeId}
        categoryId={categoryId}
      />
      <YouTubeAddModal
        open={youtubeOpen}
        onClose={() => setYoutubeOpen(false)}
        themeId={themeId}
      />
    </div>
  );
}
