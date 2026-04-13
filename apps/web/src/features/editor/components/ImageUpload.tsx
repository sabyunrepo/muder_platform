import { useRef, useState, useCallback } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { uploadImage } from '@/features/editor/imageApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImageUploadProps {
  themeId: string;
  targetId: string;
  target: 'character' | 'clue';
  currentImageUrl?: string | null;
  onUploaded: (url: string) => void;
  aspectRatio?: string;
  className?: string;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AcceptedType = (typeof ACCEPTED_TYPES)[number];

function isAcceptedType(type: string): type is AcceptedType {
  return (ACCEPTED_TYPES as readonly string[]).includes(type);
}

// ---------------------------------------------------------------------------
// ImageUpload
// ---------------------------------------------------------------------------

export function ImageUpload({
  themeId,
  targetId,
  target,
  currentImageUrl,
  onUploaded,
  aspectRatio = 'auto',
  className = '',
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl ?? null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (!isAcceptedType(file.type)) {
        toast.error('JPEG, PNG, WebP 형식만 지원합니다');
        return;
      }

      // Local preview
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      setIsUploading(true);

      try {
        const url = await uploadImage(themeId, target, targetId, file, file.type);
        onUploaded(url);
        // Replace object URL with the real URL
        setPreviewUrl(url);
        URL.revokeObjectURL(objectUrl);
        toast.success('이미지가 업로드되었습니다');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '이미지 업로드에 실패했습니다');
        // Revert to previous image on error
        setPreviewUrl(currentImageUrl ?? null);
        URL.revokeObjectURL(objectUrl);
      } finally {
        setIsUploading(false);
      }
    },
    [themeId, target, targetId, currentImageUrl, onUploaded],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        void handleFile(file);
      }
      // Reset input so the same file can be re-selected
      e.target.value = '';
    },
    [handleFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        void handleFile(file);
      }
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setPreviewUrl(null);
      onUploaded('');
    },
    [onUploaded],
  );

  const openFilePicker = useCallback(() => {
    if (!isUploading) {
      inputRef.current?.click();
    }
  }, [isUploading]);

  const hasImage = !!previewUrl;

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={handleInputChange}
        aria-label="이미지 파일 선택"
      />

      {/* Drop zone / preview container */}
      <div
        role="button"
        tabIndex={0}
        onClick={openFilePicker}
        onKeyDown={(e) => e.key === 'Enter' && openFilePicker()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{ aspectRatio }}
        className={[
          'relative flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-sm border-2 border-dashed transition-colors',
          hasImage ? 'border-transparent' : isDragOver
            ? 'border-amber-500 bg-amber-500/5'
            : 'border-slate-700 bg-slate-900 hover:border-amber-500 hover:bg-slate-800/50',
          isUploading ? 'pointer-events-none' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label={hasImage ? '이미지 변경' : '이미지 업로드'}
      >
        {/* Existing / preview image */}
        {hasImage && (
          <img
            src={previewUrl}
            alt="업로드된 이미지"
            className="h-full w-full object-cover"
          />
        )}

        {/* Placeholder (no image) */}
        {!hasImage && !isUploading && (
          <div className="flex flex-col items-center gap-2 p-4 text-slate-600">
            <ImagePlus className="h-8 w-8" />
            <span className="text-center text-[11px] leading-tight">
              클릭하거나 이미지를
              <br />
              여기에 드래그하세요
            </span>
          </div>
        )}

        {/* Upload spinner overlay */}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          </div>
        )}

        {/* "변경" button overlay on existing image */}
        {hasImage && !isUploading && (
          <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-slate-950/80 to-transparent p-2 opacity-0 transition-opacity hover:opacity-100">
            <span className="rounded-sm bg-slate-800/90 px-2 py-1 text-[11px] font-medium text-slate-200">
              변경
            </span>
            {/* Clear button */}
            <button
              type="button"
              onClick={handleClear}
              className="rounded-sm bg-slate-800/90 p-1 text-slate-400 hover:text-red-400"
              aria-label="이미지 제거"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
