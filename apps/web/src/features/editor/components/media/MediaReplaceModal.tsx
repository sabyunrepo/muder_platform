import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { RefreshCw, X } from "lucide-react";

import {
  useConfirmReplacementUpload,
  useRequestReplacementUpload,
  type MediaResponse,
  type MediaType,
} from "@/features/editor/mediaApi";
import { replaceMediaFile } from "@/features/editor/mediaReplaceUpload";
import { getDisplayErrorMessage } from "@/lib/display-error";

interface MediaReplaceModalProps {
  open: boolean;
  onClose: () => void;
  themeId: string;
  media: MediaResponse;
  onReplaced?: (media: MediaResponse) => void;
}

const MAX_SIZE = 20 * 1024 * 1024;
const MIME_BY_TYPE: Record<MediaType, string[]> = {
  BGM: ["audio/mpeg", "audio/wav", "audio/ogg"],
  SFX: ["audio/mpeg", "audio/wav", "audio/ogg"],
  VOICE: ["audio/mpeg", "audio/wav", "audio/ogg"],
  IMAGE: ["image/jpeg", "image/png", "image/webp"],
  DOCUMENT: ["application/pdf"],
  VIDEO: [],
};

export function MediaReplaceModal({
  open,
  onClose,
  themeId,
  media,
  onReplaced,
}: MediaReplaceModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputId = `media-replace-input-${media.id}`;
  const controllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const requestReplacementMutation = useRequestReplacementUpload(media.id);
  const confirmReplacementMutation = useConfirmReplacementUpload(themeId, media.id);
  const acceptedMimeTypes = useMemo(() => MIME_BY_TYPE[media.type] ?? [], [media.type]);
  const canReplace = media.source_type === "FILE" && acceptedMimeTypes.length > 0;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      controllerRef.current?.abort();
      controllerRef.current = null;
      setFile(null);
      setIsDragging(false);
      setUploading(false);
      setProgress(0);
      setError(null);
    }
  }, [open]);

  const handleFile = (nextFile: File) => {
    if (!canReplace) {
      setError("이 미디어는 파일 교체를 지원하지 않습니다");
      return;
    }
    if (nextFile.size > MAX_SIZE) {
      setError("파일 크기는 20MB 이하여야 합니다");
      return;
    }
    if (!acceptedMimeTypes.includes(nextFile.type)) {
      setError(`현재 ${mediaTypeLabel(media.type)}와 같은 형식만 교체할 수 있습니다`);
      return;
    }
    setError(null);
    setFile(nextFile);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (nextFile) handleFile(nextFile);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const nextFile = event.dataTransfer.files?.[0];
    if (nextFile) handleFile(nextFile);
  };

  const openFilePicker = () => {
    document.getElementById(inputId)?.click();
  };

  const handleDropzoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFilePicker();
    }
  };

  const handleReplace = async () => {
    if (!file) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setUploading(true);
    setError(null);
    setProgress(0);
    try {
      const replaced = await replaceMediaFile({
        file,
        requestReplacementUpload: requestReplacementMutation.mutateAsync,
        confirmReplacementUpload: confirmReplacementMutation.mutateAsync,
        onProgress: (nextProgress) => {
          if (isMountedRef.current && !controller.signal.aborted) {
            setProgress(nextProgress);
          }
        },
        signal: controller.signal,
      });
      if (!isMountedRef.current || controller.signal.aborted) return;
      onReplaced?.(replaced);
      onClose();
    } catch (err) {
      if (!isMountedRef.current || controller.signal.aborted) return;
      setError(getDisplayErrorMessage(err, "파일 교체 실패"));
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
      if (isMountedRef.current) {
        setUploading(false);
      }
    }
  };

  const handleAbort = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setUploading(false);
    setProgress(0);
    setError("파일 교체가 취소되었습니다");
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="미디어 파일 교체"
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-2xl shadow-black/40 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold text-slate-100 sm:text-lg">
            <RefreshCw className="h-5 w-5 shrink-0 text-amber-400" />
            <span className="truncate">파일 교체</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            aria-label="닫기"
            className="rounded-sm p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-3 rounded-sm border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
          <p className="truncate font-medium text-slate-100">{media.name}</p>
          <p className="mt-1 text-slate-500">
            같은 {mediaTypeLabel(media.type)} 파일로 교체하면 기존 연결은 유지됩니다.
          </p>
        </div>

        <div
          className={`cursor-pointer rounded-md border-2 border-dashed p-5 text-center transition ${
            isDragging
              ? "border-amber-400 bg-amber-500/10"
              : "border-slate-700 hover:border-slate-500"
          } ${!canReplace ? "cursor-not-allowed opacity-50" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={canReplace ? openFilePicker : undefined}
          onKeyDown={handleDropzoneKeyDown}
          role="button"
          tabIndex={canReplace ? 0 : -1}
          aria-label="교체 파일 드롭 영역"
        >
          <RefreshCw className="mx-auto mb-2 h-8 w-8 text-slate-500" />
          {file ? (
            <>
              <p className="text-sm font-medium text-slate-100">{file.name}</p>
              <p className="mt-1 text-xs text-slate-500">{formatFileSize(file.size)}</p>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-200">교체할 파일을 선택하세요</p>
              <p className="mt-1 text-xs text-slate-500">
                {acceptedMimeTypes.length > 0
                  ? acceptedMimeTypesLabel(acceptedMimeTypes)
                  : "이 유형은 파일 교체를 지원하지 않습니다"}
              </p>
            </>
          )}
          <input
            id={inputId}
            type="file"
            accept={acceptedMimeTypes.join(",")}
            className="hidden"
            onChange={handleInputChange}
            disabled={uploading || !canReplace}
          />
        </div>

        {uploading && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-slate-400">
              <span>교체 중</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
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

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={uploading ? handleAbort : onClose}
            className="h-9 rounded-sm border border-slate-700 px-4 text-sm text-slate-300 hover:border-slate-500 hover:text-slate-100"
          >
            {uploading ? "취소" : "닫기"}
          </button>
          <button
            type="button"
            onClick={handleReplace}
            disabled={!file || uploading || !canReplace}
            className="h-9 rounded-sm bg-amber-500 px-4 text-sm font-medium text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "교체 중" : "교체"}
          </button>
        </div>
      </div>
    </div>
  );
}

function mediaTypeLabel(type: MediaType): string {
  switch (type) {
    case "BGM":
      return "배경음악";
    case "SFX":
      return "효과음";
    case "VOICE":
      return "음성";
    case "IMAGE":
      return "이미지";
    case "DOCUMENT":
      return "문서";
    case "VIDEO":
      return "영상";
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function acceptedMimeTypesLabel(mimeTypes: string[]): string {
  return mimeTypes.map((mime) => mime.split("/")[1]?.toUpperCase() ?? mime).join(", ");
}
