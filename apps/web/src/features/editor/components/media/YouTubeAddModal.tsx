import { useEffect, useState } from "react";
import { Youtube, X } from "lucide-react";

import {
  useCreateYouTubeMedia,
  type MediaType,
} from "@/features/editor/mediaApi";
import { extractYouTubeVideoId } from "@/features/audio/YouTubePlayer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface YouTubeAddModalProps {
  open: boolean;
  onClose: () => void;
  themeId: string;
}

type YouTubeMediaType = Extract<MediaType, "BGM" | "VIDEO">;

// ---------------------------------------------------------------------------
// YouTubeAddModal
// ---------------------------------------------------------------------------

export function YouTubeAddModal({
  open,
  onClose,
  themeId,
}: YouTubeAddModalProps) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<YouTubeMediaType>("BGM");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateYouTubeMedia(themeId);
  const videoId = extractYouTubeVideoId(url);
  const isValidUrl = videoId !== null;

  useEffect(() => {
    if (!open) {
      setUrl("");
      setName("");
      setType("BGM");
      setError(null);
      setCreating(false);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!isValidUrl) {
      setError("올바른 YouTube URL을 입력하세요");
      return;
    }
    if (!name.trim()) {
      setError("이름을 입력하세요");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await createMutation.mutateAsync({ url, name: name.trim(), type });
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "YouTube 미디어 추가 실패";
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="YouTube 추가"
    >
      <div className="w-full max-w-md rounded-lg bg-slate-800 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
            <Youtube className="h-5 w-5 text-rose-500" />
            YouTube 추가
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            aria-label="닫기"
            className="text-slate-400 hover:text-slate-200 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label
              htmlFor="youtube-url"
              className="mb-1 block text-sm text-slate-300"
            >
              YouTube URL
            </label>
            <input
              id="youtube-url"
              type="url"
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-100"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              disabled={creating}
            />
            {url && !isValidUrl && (
              <p className="mt-1 text-xs text-rose-400">
                올바르지 않은 YouTube URL입니다
              </p>
            )}
          </div>

          {videoId && (
            <div className="overflow-hidden rounded border border-slate-700">
              <img
                src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                alt="YouTube 미리보기"
                className="w-full"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="youtube-name"
              className="mb-1 block text-sm text-slate-300"
            >
              이름
            </label>
            <input
              id="youtube-name"
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-100"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="표시 이름"
              disabled={creating}
            />
          </div>

          <div>
            <label
              htmlFor="youtube-type"
              className="mb-1 block text-sm text-slate-300"
            >
              유형
            </label>
            <select
              id="youtube-type"
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-100"
              value={type}
              onChange={(e) => setType(e.target.value as YouTubeMediaType)}
              disabled={creating}
            >
              <option value="BGM">배경음악 (오디오만)</option>
              <option value="VIDEO">비디오 (컷신/증거)</option>
            </select>
            <p className="mt-1 text-xs text-slate-400">
              {type === "BGM"
                ? "오디오만 재생됩니다"
                : "풀스크린 컷신 또는 인라인 증거 영상으로 사용됩니다"}
            </p>
          </div>
        </div>

        {error && (
          <div
            className="mt-4 rounded border border-rose-500/40 bg-rose-500/20 p-2 text-sm text-rose-200"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!isValidUrl || !name.trim() || creating}
            className="rounded bg-amber-500 px-4 py-2 text-sm text-slate-900 hover:bg-amber-400 disabled:opacity-50"
          >
            {creating ? "추가 중..." : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}
