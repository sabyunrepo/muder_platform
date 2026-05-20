import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

import { MediaPicker } from '@/features/editor/components/media/MediaPicker';
import { useMediaDownloadUrl, useMediaList, type MediaResponse } from '@/features/editor/mediaApi';
import { getMediaThumbnailUrl, hasPublicMediaUrl, MediaTypeIcon } from './mediaVisuals';

interface ImageMediaReferenceFieldProps {
  themeId: string;
  label: string;
  imageMediaId?: string | null;
  legacyImageUrl?: string | null;
  pickerTitle?: string;
  emptyLabel?: string;
  legacyHint?: string;
  disabled?: boolean;
  compact?: boolean;
  onSelect: (media: MediaResponse) => void;
  onClear: () => void;
}

export function ImageMediaReferenceField({
  themeId,
  label,
  imageMediaId,
  legacyImageUrl,
  pickerTitle,
  emptyLabel = '미디어 이미지 선택',
  legacyHint = '기존 직접 업로드 이미지가 있습니다. 미디어 관리 이미지로 교체하면 이후 한 곳에서 관리할 수 있습니다.',
  disabled = false,
  compact = false,
  onSelect,
  onClear,
}: ImageMediaReferenceFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const { data: images = [] } = useMediaList(themeId, 'IMAGE');
  const selectedImage = images.find((media) => media.id === imageMediaId) ?? null;
  const hasPublicImageUrl = selectedImage ? hasPublicMediaUrl(selectedImage) : false;
  const shouldLoadFileImagePreview =
    selectedImage?.type === 'IMAGE' && selectedImage.source_type === 'FILE' && !hasPublicImageUrl;
  const { data: fileImagePreview } = useMediaDownloadUrl(
    shouldLoadFileImagePreview ? selectedImage.id : undefined,
  );
  const previewUrl = selectedImage
    ? getMediaThumbnailUrl({
        ...selectedImage,
        url: selectedImage.url ?? fileImagePreview?.url,
      })
    : null;
  const shouldRenderPreview = Boolean(previewUrl) && !previewFailed;

  useEffect(() => {
    setPreviewFailed(false);
  }, [previewUrl, imageMediaId]);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      {imageMediaId ? (
        <div className="relative">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setPickerOpen(true)}
            aria-label={`${label} 미리보기`}
            className={`group relative flex w-full items-center justify-center overflow-hidden rounded-md border border-amber-500/30 bg-slate-950/70 text-left text-sm text-amber-100 hover:border-amber-400/60 disabled:cursor-not-allowed disabled:opacity-70 ${
              compact ? 'h-24' : 'aspect-[16/10] min-h-32'
            }`}
          >
            {shouldRenderPreview ? (
              <img
                src={previewUrl ?? undefined}
                alt={`${selectedImage?.name ?? '선택된 이미지'} 미리보기`}
                className="h-full w-full object-contain"
                loading="lazy"
                onError={() => setPreviewFailed(true)}
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                <MediaTypeIcon type="IMAGE" size="sm" />
              </span>
            )}
          </button>
          {!disabled ? (
            <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-slate-950/85 p-1 shadow-sm ring-1 ring-amber-400/30">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                aria-label={`${label} 교체`}
                className="rounded-sm px-2 py-1 text-xs font-medium text-amber-100 hover:bg-amber-400/15"
              >
                교체
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onClear();
                }}
                aria-label={`${label} 제거`}
                className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700/80"
              >
                <X className="h-3 w-3" />
                제거
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setPickerOpen(true)}
          className={`flex w-full items-center justify-center rounded-md border border-dashed border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-400 hover:border-amber-500/50 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-70 ${
            compact ? 'min-h-16' : 'aspect-[16/10]'
          }`}
        >
          {emptyLabel}
        </button>
      )}

      {!imageMediaId && legacyImageUrl ? (
        <p className="mt-2 text-xs leading-5 text-slate-500">{legacyHint}</p>
      ) : null}

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={onSelect}
        themeId={themeId}
        filterType="IMAGE"
        selectedId={imageMediaId}
        title={pickerTitle ?? `${label} 선택`}
      />
    </div>
  );
}
