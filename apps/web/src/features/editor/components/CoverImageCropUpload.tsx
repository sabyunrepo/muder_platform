import { useState, useRef, useCallback } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/shared/components/ui/Modal';
import { Button } from '@/shared/components/ui/Button';
import { uploadImage } from '@/features/editor/imageApi';
import { getCroppedBlob, makeInitialCrop } from './cropUtils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CoverImageCropUploadProps {
  themeId: string;
  currentImageUrl?: string | null;
  onUploaded: (url: string) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANVAS_OUTPUT_WIDTH = 960;
const CANVAS_OUTPUT_HEIGHT = 640;
const ASPECT_RATIO = 3 / 2;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CoverImageCropUpload({
  themeId,
  currentImageUrl,
  onUploaded,
  className,
}: CoverImageCropUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isUploading, setIsUploading] = useState(false);

  function handleClick() { fileInputRef.current?.click(); }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onUploaded('');
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = () => {
      setSrcUrl(reader.result as string);
      setCrop(undefined);
      setCompletedCrop(undefined);
      setModalOpen(true);
    };
    reader.readAsDataURL(file);
  }

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(makeInitialCrop(width, height, ASPECT_RATIO));
  }, []);

  async function handleConfirm() {
    if (!imgRef.current || !completedCrop) {
      toast.error('먼저 이미지를 자르세요');
      return;
    }
    setIsUploading(true);
    try {
      const { blob, contentType } = await getCroppedBlob(
        imgRef.current, completedCrop, CANVAS_OUTPUT_WIDTH, CANVAS_OUTPUT_HEIGHT,
      );
      const url = await uploadImage(themeId, 'cover', themeId, blob, contentType);
      onUploaded(url);
      setModalOpen(false);
      setSrcUrl(null);
      toast.success('이미지가 업로드되었습니다');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '이미지 업로드에 실패했습니다');
    } finally {
      setIsUploading(false);
    }
  }

  function handleCancel() { setModalOpen(false); setSrcUrl(null); }

  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      <div
        className={`group relative aspect-[3/2] cursor-pointer overflow-hidden rounded-sm transition-colors ${
          currentImageUrl
            ? 'border border-slate-700'
            : 'border-2 border-dashed border-slate-700 bg-slate-900 hover:border-amber-500'
        } ${className ?? ''}`}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
        aria-label="커버 이미지 업로드"
      >
        {currentImageUrl ? (
          <>
            <img src={currentImageUrl} alt="커버 이미지" className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true">
              <span className="text-sm font-medium text-white">변경</span>
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
              aria-label="이미지 제거"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-500">
            <ImagePlus className="h-8 w-8" />
            <span className="text-xs">커버 이미지 추가</span>
          </span>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={handleCancel}
        title="이미지 자르기"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={handleCancel} disabled={isUploading}>취소</Button>
            <Button onClick={handleConfirm} disabled={isUploading || !completedCrop}>
              {isUploading ? <><Loader2 className="h-4 w-4 animate-spin" />업로드 중…</> : '확인'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-slate-400">3:2 비율로 자를 영역을 선택하세요</p>
          <div className="max-h-[400px] overflow-auto rounded-lg bg-slate-950 p-2">
            {srcUrl && (
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={ASPECT_RATIO}
                minWidth={50}
                minHeight={33}
              >
                <img
                  ref={imgRef}
                  src={srcUrl}
                  alt="자르기 원본"
                  onLoad={handleImageLoad}
                  className="max-h-[360px] max-w-full object-contain"
                  style={{ display: 'block' }}
                />
              </ReactCrop>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
