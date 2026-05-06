import { Image as ImageIcon, X } from "lucide-react";

import { useMediaList, type MediaResponse } from "@/features/editor/mediaApi";
import { MediaPicker } from "../media/MediaPicker";

export function InfoImageField({
  themeId,
  imageMediaId,
  pickerOpen,
  onOpenPicker,
  onClosePicker,
  onSelect,
  onClear,
}: {
  themeId: string;
  imageMediaId?: string | null;
  pickerOpen: boolean;
  onOpenPicker: () => void;
  onClosePicker: () => void;
  onSelect: (media: MediaResponse) => void;
  onClear: () => void;
}) {
  const { data: images = [] } = useMediaList(themeId, "IMAGE");
  const selectedImage = images.find((media) => media.id === imageMediaId) ?? null;

  return (
    <div className="rounded border border-slate-800 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-300">이미지</span>
        {imageMediaId && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
          >
            <X className="h-3 w-3" />
            제거
          </button>
        )}
      </div>
      {imageMediaId ? (
        <button
          type="button"
          onClick={onOpenPicker}
          className="flex items-center gap-2 rounded bg-slate-900 px-3 py-2 text-xs text-sky-200"
        >
          <ImageIcon className="h-4 w-4" />
          {selectedImage?.name ?? "선택된 이미지"}
        </button>
      ) : (
        <button
          type="button"
          onClick={onOpenPicker}
          className="rounded border border-dashed border-slate-700 px-3 py-2 text-xs text-slate-400 hover:text-slate-200"
        >
          이미지 선택
        </button>
      )}

      <MediaPicker
        open={pickerOpen}
        onClose={onClosePicker}
        onSelect={onSelect}
        themeId={themeId}
        filterType="IMAGE"
        selectedId={imageMediaId}
        title="정보 이미지 선택"
      />
    </div>
  );
}
