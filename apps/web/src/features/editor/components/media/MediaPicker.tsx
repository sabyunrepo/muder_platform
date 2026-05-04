import { useEffect, useMemo, useState } from "react";

import { ResourcePicker } from "./ResourcePicker";
import {
  filterMediaResourceViewModels,
  getMediaResourceTypeLabel,
  toMediaResourceViewModels,
  type MediaResourceUseCase,
} from "@/features/editor/entities/mediaResource/mediaResourceAdapter";
import {
  useMediaList,
  type MediaResponse,
  type MediaType,
} from "@/features/editor/mediaApi";

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
  const { data: media = [], isLoading } = useMediaList(themeId, filterType);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!open) setSearchQuery("");
  }, [open]);

  const resourceViewModels = useMemo(
    () => toMediaResourceViewModels(media, { useCase }),
    [media, useCase],
  );
  const filteredResources = useMemo(
    () => filterMediaResourceViewModels(resourceViewModels, searchQuery),
    [resourceViewModels, searchQuery],
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
    : null;

  return (
    <ResourcePicker
      title={title || "미디어 선택"}
      resources={filteredResources}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      onClose={onClose}
      onSelect={handleSelect}
      selectedId={selectedId}
      isLoading={isLoading}
      emptyLabel="미디어가 없습니다"
      searchEmptyLabel="검색 결과가 없습니다"
      filterHint={filterHint}
    />
  );
}
