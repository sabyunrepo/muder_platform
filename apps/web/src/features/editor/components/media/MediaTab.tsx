import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ListChecks, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, Modal, Spinner } from "@/shared/components/ui";
import { editorDesignClassNames } from "@/features/editor/design-system/editorDesignTokens";
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
  const [pendingDeleteCategoryId, setPendingDeleteCategoryId] = useState<string | null>(null);
  // Modal state.
  const [uploadOpen, setUploadOpen] = useState(false);
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const isDesktopLayout = useMediaQuery("(min-width: 1024px)", true);

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
  const pendingDeleteCategory =
    categories.find((item) => item.id === pendingDeleteCategoryId) ?? null;

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
    lastFocusedElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
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
    setPendingDeleteCategoryId(categoryId);
  };

  const handleConfirmDeleteCategory = () => {
    if (!pendingDeleteCategoryId) return;
    deleteCategoryMutation.mutate(pendingDeleteCategoryId, {
      onSuccess: () => {
        setCategoryId(null);
        setSelectedId(null);
        setPendingDeleteCategoryId(null);
        stopPreview();
      },
      onError: () => {
        setPendingDeleteCategoryId(null);
      },
    });
  };

  const handleClose = () => {
    setSelectedId(null);
    window.requestAnimationFrame(() => {
      lastFocusedElementRef.current?.focus();
      lastFocusedElementRef.current = null;
    });
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
          await deleteMediaMutation.mutateAsync({ id: item.id });
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
    <div className={`flex h-full min-h-0 flex-col ${editorDesignClassNames.surface}`}>
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
            <div className={`sticky bottom-0 top-0 z-20 mb-3 flex flex-col gap-2 p-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between ${editorDesignClassNames.panel}`}>
              <div className="flex items-center gap-2 text-xs text-[var(--mmp-editor-color-charcoal)]">
                <ListChecks className="h-4 w-4 text-[var(--mmp-editor-color-primary)]" />
                <span>선택한 미디어 {selectedIds.size}개</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearBulkSelection}
                  className={`h-8 px-3 text-xs ${editorDesignClassNames.secondaryAction}`}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleOpenBulkDelete}
                  disabled={selectedIds.size === 0}
                  className={`flex h-8 items-center gap-1.5 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${editorDesignClassNames.dangerAction}`}
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
              <p className="text-xs text-[var(--mmp-editor-color-error)]">미디어 목록을 불러오지 못했습니다</p>
            </div>
          ) : media.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-xs font-mono uppercase tracking-widest text-[var(--mmp-editor-color-steel)]">
                  미디어 없음
                </p>
                {searchQuery.trim() && (
                  <p className="mt-2 text-xs text-[var(--mmp-editor-color-slate)]">검색어나 필터를 조정해 보세요</p>
                )}
              </div>
            </div>
          ) : (
            <div
              className="grid max-w-[39rem] grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3"
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
        {selected && isDesktopLayout && (
          <aside className="min-h-0 w-full shrink-0 border-t border-[var(--mmp-editor-color-hairline)] pt-4 lg:w-96 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
            <MediaDetail media={selected} themeId={themeId} onClose={handleClose} />
          </aside>
        )}
      </div>

      {!isDesktopLayout && (
        <MediaMobileDetailSheet open={selected != null} onClose={handleClose}>
          {selected && <MediaDetail media={selected} themeId={themeId} onClose={handleClose} />}
        </MediaMobileDetailSheet>
      )}

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
      <ConfirmDialog
        isOpen={pendingDeleteCategory != null}
        title="카테고리를 삭제할까요?"
        description={`"${pendingDeleteCategory?.name ?? '선택한 카테고리'}" 카테고리를 삭제합니다. 연결된 미디어는 전체 카테고리로 이동합니다.`}
        confirmLabel="카테고리 삭제"
        isConfirming={deleteCategoryMutation.isPending}
        tone="danger"
        onCancel={() => setPendingDeleteCategoryId(null)}
        onConfirm={handleConfirmDeleteCategory}
      />
    </div>
  );
}

function MediaMobileDetailSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const firstFocusable = getFocusableElements(dialogRef.current)[0];
    firstFocusable?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" aria-labelledby="media-mobile-detail-title">
      <button
        type="button"
        aria-label="미디어 상세 닫기"
        className="absolute inset-0 h-full w-full cursor-default bg-[rgba(26,26,26,0.42)]"
        onClick={onClose}
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-mobile-detail-title"
        className={`absolute inset-x-0 bottom-0 flex max-h-[80dvh] min-h-[18rem] flex-col rounded-t-2xl p-4 outline-none ${editorDesignClassNames.panel}`}
      >
        <h2 id="media-mobile-detail-title" className="sr-only">
          미디어 상세
        </h2>
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-[var(--mmp-editor-color-hairline-strong)]" aria-hidden="true" />
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
      </section>
    </div>
  );
}

function useMediaQuery(query: string, defaultValue: boolean) {
  const getMatches = () => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return defaultValue;
    }
    return window.matchMedia(query).matches;
  };
  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia(query);
    const handleChange = () => setMatches(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

function getFocusableElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      [
        "button:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "a[href]",
        "[tabindex]:not([tabindex='-1'])",
      ].join(","),
    ),
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
            className={`h-9 px-4 text-xs ${editorDesignClassNames.primaryAction}`}
          >
            확인
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className={`h-9 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${editorDesignClassNames.secondaryAction}`}
            >
              취소
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={deleting || selectedMedia.length === 0}
              className={`flex h-9 items-center gap-1.5 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${editorDesignClassNames.dangerAction}`}
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
        <div className="space-y-4 text-sm text-[var(--mmp-editor-color-charcoal)]">
          <p className="text-xs text-[var(--mmp-editor-color-slate)]">
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
    <div className="space-y-4 text-sm text-[var(--mmp-editor-color-charcoal)]">
      {result.deleted.length > 0 && (
        <ResultSection
          icon={<CheckCircle2 className="h-4 w-4 text-[var(--mmp-editor-color-success)]" />}
          title={`삭제됨 ${result.deleted.length}개`}
        >
          <MediaNameList items={result.deleted} />
        </ResultSection>
      )}
      {result.blocked.length > 0 && (
        <ResultSection
          icon={<AlertTriangle className="h-4 w-4 text-[var(--mmp-editor-color-warning)]" />}
          title={`참조 중이라 삭제되지 않음 ${result.blocked.length}개`}
        >
          <div className="space-y-3">
            {result.blocked.map((item) => (
              <div key={item.media.id} className="rounded-sm border border-[var(--mmp-editor-color-warning)] bg-[var(--mmp-editor-color-tint-yellow)] p-3">
                <p className="text-xs font-medium text-[var(--mmp-editor-color-charcoal)]">{item.media.name}</p>
                {item.references.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-[var(--mmp-editor-color-slate)]">
                    {item.references.map((ref, index) => (
                      <li key={`${item.media.id}-${ref.type}-${index}`} className="break-words">
                        <span className="font-medium">{mediaReferenceTypeLabel(ref.type)}</span>:{" "}
                        {ref.name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-[var(--mmp-editor-color-slate)]">
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
          icon={<XCircle className="h-4 w-4 text-[var(--mmp-editor-color-error)]" />}
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
        <h3 className="text-xs font-semibold text-[var(--mmp-editor-color-charcoal)]">{title}</h3>
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
          className={`flex items-center justify-between gap-3 px-3 py-2 ${editorDesignClassNames.listItem}`}
        >
          <span className="min-w-0 truncate text-xs text-[var(--mmp-editor-color-charcoal)]">{item.name}</span>
          <span className="shrink-0 rounded-sm bg-[var(--mmp-editor-color-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--mmp-editor-color-slate)]">
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
