import { useEffect, useState, type ChangeEvent, type DragEvent } from "react";
import { Upload, X } from "lucide-react";

import {
  uploadMediaFile,
  useConfirmUpload,
  useRequestUploadUrl,
  type MediaType,
} from "@/features/editor/mediaApi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MediaUploadModalProps {
  open: boolean;
  onClose: () => void;
  themeId: string;
}

const MAX_SIZE = 20 * 1024 * 1024;
const ALLOWED_MIME = [
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
];

// ---------------------------------------------------------------------------
// MediaUploadModal
// ---------------------------------------------------------------------------

export function MediaUploadModal({
  open,
  onClose,
  themeId,
}: MediaUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<MediaType>("BGM");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const requestUrlMutation = useRequestUploadUrl(themeId);
  const confirmMutation = useConfirmUpload(themeId);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setName("");
      setType("BGM");
      setProgress(0);
      setError(null);
      setUploading(false);
      setIsDragging(false);
    }
  }, [open]);

  const handleFile = (f: File) => {
    if (f.size > MAX_SIZE) {
      setError("파일 크기는 20MB 이하여야 합니다");
      return;
    }
    if (!ALLOWED_MIME.includes(f.type)) {
      setError("지원하지 않는 파일 형식입니다 (MP3, WAV, OGG, M4A, AAC)");
      return;
    }
    setError(null);
    setFile(f);
    const defaultName = f.name.replace(/\.[^.]+$/, "");
    setName((prev) => (prev ? prev : defaultName));
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setProgress(0);
    try {
      await uploadMediaFile({
        themeId,
        file,
        type,
        name: name || file.name,
        requestUploadUrl: requestUrlMutation.mutateAsync,
        confirmUpload: confirmMutation.mutateAsync,
        onProgress: setProgress,
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "업로드 실패";
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="파일 업로드"
    >
      <div className="w-full max-w-md rounded-lg bg-slate-800 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">파일 업로드</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            aria-label="닫기"
            className="text-slate-400 hover:text-slate-200 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className={`cursor-pointer rounded-md border-2 border-dashed p-6 text-center transition ${
            isDragging
              ? "border-amber-400 bg-amber-500/10"
              : "border-slate-600 hover:border-slate-500"
          }`}
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() =>
            document.getElementById("media-upload-input")?.click()
          }
          role="button"
          tabIndex={0}
          aria-label="파일 드롭 영역"
        >
          <Upload className="mx-auto mb-2 h-8 w-8 text-slate-400" />
          {file ? (
            <>
              <p className="text-sm text-slate-200">{file.name}</p>
              <p className="text-xs text-slate-400">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-400">
              파일을 드래그하거나 클릭하여 선택
            </p>
          )}
        </div>
        <input
          id="media-upload-input"
          data-testid="media-upload-input"
          type="file"
          className="hidden"
          accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac"
          onChange={handleInputChange}
        />

        {file && (
          <div className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="media-upload-name"
                className="mb-1 block text-sm text-slate-300"
              >
                이름
              </label>
              <input
                id="media-upload-name"
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-100"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={uploading}
              />
            </div>
            <div>
              <label
                htmlFor="media-upload-type"
                className="mb-1 block text-sm text-slate-300"
              >
                유형
              </label>
              <select
                id="media-upload-type"
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-100"
                value={type}
                onChange={(e) => setType(e.target.value as MediaType)}
                disabled={uploading}
              >
                <option value="BGM">배경음악</option>
                <option value="SFX">효과음</option>
                <option value="VOICE">음성</option>
              </select>
            </div>
          </div>
        )}

        {uploading && (
          <div className="mt-4" role="status" aria-label="업로드 진행률">
            <div
              className="h-2 overflow-hidden rounded bg-slate-700"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-amber-400 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-center text-xs text-slate-400">
              {progress}% 업로드 중...
            </p>
          </div>
        )}

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
            disabled={uploading}
            className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || uploading || !name}
            className="rounded bg-amber-500 px-4 py-2 text-sm text-slate-900 hover:bg-amber-400 disabled:opacity-50"
          >
            {uploading ? "업로드 중..." : "업로드"}
          </button>
        </div>
      </div>
    </div>
  );
}
