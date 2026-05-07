import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ListChecks, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/shared/components/ui";
import { Modal } from "@/shared/components/ui";
import {
  useCreateMediaCategory,
  useDeleteMedia,
  useDeleteMediaCategory,
  useMediaCategories,
  useMediaList,
  type MediaReferenceInfo,
  type MediaResponse,
  type MediaType,
} from "@/features/editor/mediaApi";
import { ApiHttpError } from "@/lib/api-error";
import { MediaToolbar, type MediaFilter } from "./MediaToolbar";
import { MediaCard } from "./MediaCard";
import { MediaDetail } from "./MediaDetail";
import { MediaUploadModal } from "./MediaUploadModal";
import { YouTubeAddModal } from "./YouTubeAddModal";
import { usePreviewPlayer } from "./usePreviewPlayer";
import { getMediaTypeBadgeLabel } from "./mediaVisuals";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MediaTabProps {
  themeId: string;
}

type BulkDeleteBlockedItem = {
  media: MediaResponse;
  references: MediaReferenceInfo[];
};

type BulkDeleteResult = {
  deleted: MediaResponse[];
  blocked: BulkDeleteBlockedItem[];
  failed: MediaResponse[];
};

// ---------------------------------------------------------------------------
// MediaTab
// ---------------------------------------------------------------------------

export function MediaTab({ themeId }: MediaTabProps) {
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteResult, setDeleteResult] = useState<BulkDeleteResult | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  // Modal state.
  const [uploadOpen, setUploadOpen] = useState(false);
  const [youtubeOpen, setYoutubeOpen] = useState(false);

  const queryType: MediaType | undefined =
    filter === "all" ? undefined : filter;

  const { data: categories = [] } = useMediaCategories(themeId);
  const createCategoryMutation = useCreateMediaCategory(themeId);
  const deleteCategoryMutation = useDeleteMediaCategory(themeId);
  const deleteMediaMutation = useDeleteMedia(themeId);
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
  const bulkSelectedMedia = media.filter((m) => selectedIds.has(m.id));

  const { playingId, toggle: togglePreview, stop: stopPreview } = usePreviewPlayer();

  const handleFilterChange = (next: MediaFilter) => {
    setFilter(next);
    setSelectedId(null);
    clearBulkSelection();
    stopPreview();
  };

  const handleCategoryChange = (nextCategoryId: string | null) => {
    setCategoryId(nextCategoryId);
    setSelectedId(null);
    clearBulkSelection();
    stopPreview();
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setSelectedId(null);
    clearBulkSelection();
    stopPreview();
  };

  const clearBulkSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setDeleteResult(null);
    setDeleteDialogOpen(false);
  };

  const toggleBulkSelection = (mediaId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(mediaId)) next.delete(mediaId);
      else next.add(mediaId);
      return next;
    });
  };

  const handleSelectionModeToggle = () => {
    if (selectionMode) {
      clearBulkSelection();
      return;
    }
    setSelectedId(null);
    stopPreview();
    setSelectionMode(true);
  };

  const handleCardClick = (item: MediaResponse) => {
    if (selectionMode) {
      toggleBulkSelection(item.id);
      return;
    }
    setSelectedId(item.id);
  };

  const handleCreateCategory = () => {
    const name = window.prompt("새 미디어 카테고리 이름을 입력하세요")?.trim();
    if (!name) return;
    const nextSortOrder =
      categories.reduce((max, category) => Math.max(max, category.sort_order), 0) + 1;
    createCategoryMutation.mutate({
      name,
      sort_order: nextSortOrder,
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

  const handleOpenBulkDelete = () => {
    if (bulkSelectedMedia.length === 0) {
      toast.error("삭제할 미디어를 먼저 선택하세요");
      return;
    }
    setDeleteResult(null);
    setDeleteDialogOpen(true);
  };

  const handleCloseBulkDelete = () => {
    setDeleteDialogOpen(false);
    setDeleteResult(null);
    if (selectedIds.size === 0) {
      setSelectionMode(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (bulkSelectedMedia.length === 0) return;
    setBulkDeleting(true);
    const result: BulkDeleteResult = { deleted: [], blocked: [], failed: [] };

    try {
      for (const item of bulkSelectedMedia) {
        try {
          await deleteMediaMutation.mutateAsync(item.id);
          result.deleted.push(item);
        } catch (err) {
          if (err instanceof ApiHttpError && err.apiError.code === "MEDIA_REFERENCE_IN_USE") {
            const references = err.apiError.params?.references as MediaReferenceInfo[] | undefined;
            result.blocked.push({
              media: item,
              references: references ?? [],
            });
          } else {
            result.failed.push(item);
          }
        }
      }

      setSelectedIds(
        new Set([
          ...result.blocked.map((item) => item.media.id),
          ...result.failed.map((item) => item.id),
        ]),
      );
      setDeleteResult(result);

      if (result.deleted.length > 0 && result.blocked.length === 0 && result.failed.length === 0) {
        toast.success(`${result.deleted.length}개 미디어를 삭제했습니다`);
      } else if (result.deleted.length > 0) {
        toast.success(`${result.deleted.length}개 미디어를 삭제했습니다`);
      }
    } finally {
      setBulkDeleting(false);
    }
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
        selectionMode={selectionMode}
        selectedCount={selectedIds.size}
        onSelectionModeToggle={handleSelectionModeToggle}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row lg:overflow-hidden">
        {/* List */}
        <div className="min-h-0 flex-1 overflow-visible lg:overflow-y-auto">
          {selectionMode && (
            <div className="sticky bottom-0 top-0 z-20 mb-3 flex flex-col gap-2 rounded-sm border border-slate-700 bg-slate-950/95 p-3 shadow-lg shadow-black/30 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <ListChecks className="h-4 w-4 text-amber-400" />
                <span>선택한 미디어 {selectedIds.size}개</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearBulkSelection}
                  className="h-8 rounded-sm border border-slate-700 px-3 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleOpenBulkDelete}
                  disabled={selectedIds.size === 0}
                  className="flex h-8 items-center gap-1.5 rounded-sm border border-rose-800 bg-rose-950/40 px-3 text-xs font-medium text-rose-200 transition-colors hover:border-rose-500 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  선택 삭제
                </button>
              </div>
            </div>
          )}
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
                    onClick={() => handleCardClick(m)}
                    isPreviewPlaying={playingId === m.id}
                    onPreviewToggle={() => {
                      if (m.url) togglePreview(m.id, m.url);
                    }}
                    selectionMode={selectionMode}
                    checked={selectedIds.has(m.id)}
                    onCheckedChange={() => toggleBulkSelection(m.id)}
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
        categoryId={categoryId}
      />
      <BulkDeleteDialog
        open={deleteDialogOpen}
        selectedMedia={bulkSelectedMedia}
        result={deleteResult}
        deleting={bulkDeleting}
        onClose={handleCloseBulkDelete}
        onConfirm={handleConfirmBulkDelete}
      />
    </div>
  );
}

function BulkDeleteDialog({
  open,
  selectedMedia,
  result,
  deleting,
  onClose,
  onConfirm,
}: {
  open: boolean;
  selectedMedia: MediaResponse[];
  result: BulkDeleteResult | null;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const hasResult = result != null;
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={hasResult ? "미디어 삭제 결과" : "선택한 미디어 삭제"}
      size="lg"
      footer={
        hasResult ? (
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-sm bg-slate-100 px-4 text-xs font-medium text-slate-950 transition-colors hover:bg-white"
          >
            확인
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="h-9 rounded-sm border border-slate-700 px-4 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={deleting || selectedMedia.length === 0}
              className="flex h-9 items-center gap-1.5 rounded-sm bg-rose-700 px-4 text-xs font-medium text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleting ? "삭제 중" : "삭제"}
            </button>
          </>
        )
      }
    >
      {hasResult ? (
        <BulkDeleteResultView result={result} />
      ) : (
        <div className="space-y-4 text-sm text-slate-200">
          <p className="text-xs text-slate-400">
            아래 미디어를 삭제합니다. 이미 제작 요소에서 사용 중인 항목은 삭제되지 않고,
            사용 위치가 결과에 표시됩니다.
          </p>
          <MediaNameList items={selectedMedia} />
        </div>
      )}
    </Modal>
  );
}

function BulkDeleteResultView({ result }: { result: BulkDeleteResult }) {
  return (
    <div className="space-y-4 text-sm text-slate-200">
      {result.deleted.length > 0 && (
        <ResultSection
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          title={`삭제됨 ${result.deleted.length}개`}
        >
          <MediaNameList items={result.deleted} />
        </ResultSection>
      )}
      {result.blocked.length > 0 && (
        <ResultSection
          icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
          title={`참조 중이라 삭제되지 않음 ${result.blocked.length}개`}
        >
          <div className="space-y-3">
            {result.blocked.map((item) => (
              <div key={item.media.id} className="rounded-sm border border-amber-800/60 bg-amber-950/20 p-3">
                <p className="text-xs font-medium text-amber-100">{item.media.name}</p>
                {item.references.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-amber-100/80">
                    {item.references.map((ref, index) => (
                      <li key={`${item.media.id}-${ref.type}-${index}`} className="break-words">
                        <span className="font-medium">{mediaReferenceTypeLabel(ref.type)}</span>:{" "}
                        {ref.name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-amber-100/70">
                    연결 위치를 다시 불러온 뒤 해제하세요.
                  </p>
                )}
              </div>
            ))}
          </div>
        </ResultSection>
      )}
      {result.failed.length > 0 && (
        <ResultSection
          icon={<XCircle className="h-4 w-4 text-rose-400" />}
          title={`삭제 실패 ${result.failed.length}개`}
        >
          <MediaNameList items={result.failed} />
        </ResultSection>
      )}
    </div>
  );
}

function ResultSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-xs font-semibold text-slate-100">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function MediaNameList({ items }: { items: MediaResponse[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center justify-between gap-3 rounded-sm border border-slate-800 bg-slate-950/70 px-3 py-2"
        >
          <span className="min-w-0 truncate text-xs text-slate-200">{item.name}</span>
          <span className="shrink-0 rounded-sm bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
            {getMediaTypeBadgeLabel(item.type)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function mediaReferenceTypeLabel(type: string): string {
  switch (type) {
    case "reading_section":
      return "리딩 섹션";
    case "role_sheet":
      return "역할지";
    case "phase_action":
      return "단계 연출";
    case "event_trigger_action":
    case "event_progression_trigger_action":
      return "트리거 연출";
    default:
      return "사용 위치";
  }
}
