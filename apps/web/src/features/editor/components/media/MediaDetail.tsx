import { useEffect, useState } from "react";
import { X, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  useDeleteMedia,
  useUpdateMedia,
  type MediaReferenceInfo,
  type MediaResponse,
  type UpdateMediaRequest,
} from "@/features/editor/mediaApi";
import { ApiHttpError } from "@/lib/api-error";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MediaDetailProps {
  media: MediaResponse;
  themeId: string;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// MediaDetail
// ---------------------------------------------------------------------------

export function MediaDetail({ media, themeId, onClose }: MediaDetailProps) {
  const [name, setName] = useState(media.name);
  const [tagsText, setTagsText] = useState((media.tags ?? []).join(", "));
  const [sortOrder, setSortOrder] = useState<number>(media.sort_order);
  const [duration, setDuration] = useState<string>(
    media.duration != null ? String(media.duration) : "",
  );

  // Reset local state when selected media changes
  useEffect(() => {
    setName(media.name);
    setTagsText((media.tags ?? []).join(", "));
    setSortOrder(media.sort_order);
    setDuration(media.duration != null ? String(media.duration) : "");
  }, [media.id, media.name, media.tags, media.sort_order, media.duration]);

  const updateMutation = useUpdateMedia(themeId);
  const deleteMutation = useDeleteMedia(themeId);

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("이름은 필수입니다");
      return;
    }
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const durationNum = duration.trim() ? Number(duration) : undefined;
    if (durationNum != null && (!Number.isFinite(durationNum) || durationNum < 0)) {
      toast.error("길이는 0 이상 숫자여야 합니다");
      return;
    }
    const patch: UpdateMediaRequest = {
      name: trimmedName,
      type: media.type,
      sort_order: sortOrder,
      tags,
      ...(durationNum != null ? { duration: durationNum } : {}),
    };
    updateMutation.mutate(
      { id: media.id, patch },
      {
        onSuccess: () => toast.success("미디어가 저장되었습니다"),
        onError: () => toast.error("미디어 저장에 실패했습니다"),
      },
    );
  };

  const handleDelete = async () => {
    if (typeof window !== "undefined") {
      const ok = window.confirm(`"${media.name}"을(를) 삭제하시겠습니까?`);
      if (!ok) return;
    }
    try {
      await deleteMutation.mutateAsync(media.id);
      toast.success("미디어가 삭제되었습니다");
      onClose();
    } catch (err) {
      if (err instanceof ApiHttpError && err.apiError.code === "MEDIA_REFERENCE_IN_USE") {
        const refs = err.apiError.params?.references as
          | MediaReferenceInfo[]
          | undefined;
        const refList = refs?.map((r) => `- ${r.name}`).join("\n") ?? "";
        if (typeof window !== "undefined") {
          window.alert(
            `이 미디어는 다음 리딩 섹션에서 사용 중입니다:\n${refList}`,
          );
        }
        return;
      }
      toast.error("미디어 삭제에 실패했습니다");
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono uppercase tracking-widest text-slate-500">
          미디어 상세
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="상세 닫기"
          className="rounded-sm p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Form */}
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
            이름
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 rounded-sm border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
            태그 (쉼표 구분)
          </span>
          <input
            type="text"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="전투, 긴장감"
            className="h-8 rounded-sm border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              정렬 순서
            </span>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="h-8 rounded-sm border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              길이 (초)
            </span>
            <input
              type="number"
              min={0}
              step="0.1"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="h-8 rounded-sm border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
            />
          </label>
        </div>

        {/* Read-only metadata */}
        <div className="rounded-sm border border-slate-800 bg-slate-950/50 px-3 py-2 text-[10px] font-mono text-slate-500">
          <div>type: {media.type}</div>
          <div>source: {media.source_type}</div>
          {media.mime_type && <div>mime: {media.mime_type}</div>}
          {media.file_size != null && <div>size: {media.file_size} B</div>}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="flex h-8 items-center gap-1.5 rounded-sm border border-rose-800 px-3 text-xs font-medium text-rose-400 transition-colors hover:border-rose-500 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
          삭제
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="flex h-8 items-center gap-1.5 rounded-sm bg-amber-600 px-3 text-xs font-medium text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5" />
          저장
        </button>
      </div>
    </div>
  );
}
