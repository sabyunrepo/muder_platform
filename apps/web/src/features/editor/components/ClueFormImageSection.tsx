import { useEffect, useRef } from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { ImageUpload } from './ImageUpload';

// ---------------------------------------------------------------------------
// ClueFormImageSection
//
// Two modes:
//   - edit mode (clueId provided): renders the full ImageUpload component
//     that talks to the backend directly.
//   - create mode: stages the file locally (pendingImage / pendingPreview);
//     the parent submits the form, then uses the staged File to upload after
//     the clue is created.
// ---------------------------------------------------------------------------

export interface ClueFormImageSectionProps {
  themeId: string;
  isEditMode: boolean;
  clueId?: string;
  imageUrl: string;
  onImageUrlChange: (url: string) => void;
  pendingImage: File | null;
  pendingPreview: string | null;
  isUploading: boolean;
  onPendingImageSelect: (file: File) => void;
  onPendingImageClear: () => void;
}

export function ClueFormImageSection({
  themeId,
  isEditMode,
  clueId,
  imageUrl,
  onImageUrlChange,
  pendingImage: _pendingImage,
  pendingPreview,
  isUploading,
  onPendingImageSelect,
  onPendingImageClear,
}: ClueFormImageSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke the object URL when the preview changes or this section unmounts.
  useEffect(() => {
    return () => {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    };
  }, [pendingPreview]);

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onPendingImageSelect(file);
  }

  function handleClear() {
    onPendingImageClear();
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      onPendingImageSelect(file);
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-300">이미지</span>

      {isEditMode && clueId ? (
        <ImageUpload
          themeId={themeId}
          targetId={clueId}
          target="clue"
          currentImageUrl={imageUrl || null}
          onUploaded={onImageUrlChange}
          aspectRatio="16/9"
          className="w-full max-w-xs"
        />
      ) : (
        <div className="relative">
          {pendingPreview ? (
            <div
              className="relative w-full max-w-xs overflow-hidden rounded-lg border border-slate-700"
              style={{ aspectRatio: '16/9' }}
            >
              <img
                src={pendingPreview}
                alt="미리보기"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-1.5 top-1.5 rounded-full bg-slate-900/80 p-0.5 text-slate-300 hover:text-white"
                aria-label="이미지 제거"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60">
                  <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
                </div>
              )}
            </div>
          ) : (
            <div
              className="flex w-full max-w-xs cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-800/50 p-6 text-slate-500 transition-colors hover:border-amber-500/50 hover:text-amber-400"
              style={{ aspectRatio: '16/9' }}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              role="button"
              tabIndex={0}
              onKeyDown={(e) =>
                e.key === 'Enter' && fileInputRef.current?.click()
              }
              aria-label="이미지 선택"
            >
              <ImagePlus className="h-6 w-6" />
              <span className="text-xs">
                클릭하거나 드래그하여 이미지 선택
              </span>
              <span className="text-[11px] text-slate-600">
                JPG, PNG, WEBP
              </span>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileInputChange}
            className="sr-only"
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
}
