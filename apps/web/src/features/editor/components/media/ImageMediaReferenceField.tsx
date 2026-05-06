import { useState } from 'react';
import { Image, X } from 'lucide-react';

import { MediaPicker } from '@/features/editor/components/media/MediaPicker';
import { useMediaList, type MediaResponse } from '@/features/editor/mediaApi';

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
  const { data: images = [] } = useMediaList(themeId, 'IMAGE');
  const selectedImage = images.find((media) => media.id === imageMediaId) ?? null;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
          <Image className="h-3.5 w-3.5 text-amber-400" />
          {label}
        </div>
        {imageMediaId && !disabled ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <X className="h-3 w-3" />
            제거
          </button>
        ) : null}
      </div>

      {imageMediaId ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setPickerOpen(true)}
          className="flex w-full items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-sm text-amber-100 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <span className="truncate">{selectedImage?.name ?? '선택된 이미지'}</span>
          <span className="shrink-0 text-xs text-amber-200/70">교체</span>
        </button>
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
