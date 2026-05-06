import { useEffect, useMemo, useState } from "react";

import { ResourcePicker } from "./ResourcePicker";
import { MediaUploadModal } from "./MediaUploadModal";
import {
  filterMediaResourceViewModels,
  getAllowedMediaTypesForUseCase,
  getMediaResourceTypeLabel,
  toMediaResourceViewModels,
  type MediaResourceUseCase,
} from "@/features/editor/entities/mediaResource/mediaResourceAdapter";
import {
  useMediaCategories,
  useMediaList,
  type MediaResponse,
  type MediaType,
} from "@/features/editor/mediaApi";
import { getMediaThumbnailUrl } from "./mediaVisuals";

export interface MediaPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (media: MediaResponse) => void;
  themeId: string;
  /** When set, only media of this type are queried/listed. */
  filterType?: MediaType;
  /** Restrict selection for a creator workflow without exposing storage details. */
  useCase?: MediaResourceUseCase;
  /** Highlight currently selected media id. */
  selectedId?: string | null;
  /** Optional dialog title (defaults to "미디어 선택"). */
  title?: string;
}

export function MediaPicker({
  open,
  onClose,
  onSelect,
  themeId,
  filterType,
  useCase,
  selectedId,
  title,
}: MediaPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const allowedTypes = useMemo(
    () => (useCase ? getAllowedMediaTypesForUseCase(useCase) : []),
    [useCase],
  );
  const queryType = filterType ?? (allowedTypes.length === 1 ? allowedTypes[0] : undefined);
  const { data: media = [], isLoading } = useMediaList(
    themeId,
    queryType,
    categoryId ?? undefined,
  );
  const { data: categories = [] } = useMediaCategories(themeId);

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setCategoryId(null);
      setUploadOpen(false);
    }
  }, [open]);

  const resourceViewModels = useMemo(
    () => toMediaResourceViewModels(media, { useCase }),
    [media, useCase],
  );
  const selectableResources = useMemo(
    () => (useCase ? resourceViewModels.filter((resource) => resource.isSelectable) : resourceViewModels),
    [resourceViewModels, useCase],
  );
  const filteredResources = useMemo(
    () =>
      filterMediaResourceViewModels(selectableResources, searchQuery).map((resource) => {
        const source = media.find((item) => item.id === resource.id);
        return {
          ...resource,
          thumbnailUrl: source ? getMediaThumbnailUrl(source) : null,
        };
      }),
    [media, selectableResources, searchQuery],
  );

  if (!open) return null;

  const handleSelect = (resourceId: string) => {
    const selected = media.find((item) => item.id === resourceId);
    if (!selected) return;
    onSelect(selected);
    onClose();
  };

  const filterHint = filterType
    ? `${getMediaResourceTypeLabel(filterType)} 유형만 표시됩니다`
    : allowedTypes.length > 0
      ? `${allowedTypes.map(getMediaResourceTypeLabel).join(", ")} 유형만 표시됩니다`
      : null;
  const uploadTypes = filterType ? [filterType] : allowedTypes.length > 0 ? allowedTypes : undefined;
  const canUploadFromPicker =
    !uploadTypes || uploadTypes.some((type) => type !== "VIDEO");

  return (
    <>
      <ResourcePicker
        title={title || "미디어 선택"}
        resources={filteredResources}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onClose={onClose}
        onSelect={handleSelect}
        categories={categories}
        categoryId={categoryId}
        onCategoryChange={setCategoryId}
        onUploadClick={canUploadFromPicker ? () => setUploadOpen(true) : undefined}
        selectedId={selectedId}
        isLoading={isLoading}
        emptyLabel="미디어가 없습니다"
        searchEmptyLabel="검색 결과가 없습니다"
        filterHint={filterHint}
      />
      <MediaUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        themeId={themeId}
        categoryId={categoryId}
        allowedTypes={uploadTypes}
        onUploaded={(media) => {
          onSelect(media);
          onClose();
        }}
      />
    </>
  );
}
