import { useState, useRef, useCallback } from 'react';
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/shared/components/ui/Modal';
import { Button } from '@/shared/components/ui/Button';
import { uploadImage } from '@/features/editor/imageApi';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ImageCropUploadProps {
  themeId: string;
  targetId: string;
  target: 'character' | 'clue';
  currentImageUrl?: string | null;
  onUploaded: (url: string) => void;
  size?: 'sm' | 'md' | 'lg';
  shape?: 'circle' | 'square';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PREVIEW_SIZE = {
  sm: 64,
  md: 96,
  lg: 128,
} as const;

const CANVAS_OUTPUT_SIZE = 512; // px — exported blob resolution

// ---------------------------------------------------------------------------
// Helper: extract cropped blob from canvas
// ---------------------------------------------------------------------------

function getCroppedBlob(
  image: HTMLImageElement,
  pixelCrop: PixelCrop,
  contentType: string,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_OUTPUT_SIZE;
  canvas.height = CANVAS_OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  ctx.drawImage(
    image,
    pixelCrop.x * scaleX,
    pixelCrop.y * scaleY,
    pixelCrop.width * scaleX,
    pixelCrop.height * scaleY,
    0,
    0,
    CANVAS_OUTPUT_SIZE,
    CANVAS_OUTPUT_SIZE,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob returned null'));
      },
      contentType,
      0.92,
    );
  });
}

// ---------------------------------------------------------------------------
// Helper: make a centered 1:1 crop on image load
// ---------------------------------------------------------------------------

function makeInitialCrop(width: number, height: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, 1, width, height),
    width,
    height,
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImageCropUpload({
  themeId,
  targetId,
  target,
  currentImageUrl,
  onUploaded,
  size = 'md',
  shape = 'circle',
}: ImageCropUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isUploading, setIsUploading] = useState(false);

  const previewPx = PREVIEW_SIZE[size];
  const isCircle = shape === 'circle';

  // -- Open file picker
  function handleClick() {
    fileInputRef.current?.click();
  }

  // -- File selected → read as data URL and open modal
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset so the same file can be picked again
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

  // -- Image loaded in <img> → set initial crop
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(makeInitialCrop(width, height));
  }, []);

  // -- Confirm crop → extract blob → upload
  async function handleConfirm() {
    if (!imgRef.current || !completedCrop) {
      toast.error('먼저 이미지를 자르세요');
      return;
    }

    setIsUploading(true);
    try {
      const contentType = 'image/png';
      const blob = await getCroppedBlob(imgRef.current, completedCrop, contentType);
      const url = await uploadImage(themeId, target, targetId, blob, contentType);
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

  function handleCancel() {
    setModalOpen(false);
    setSrcUrl(null);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Avatar preview / trigger */}
      <button
        type="button"
        onClick={handleClick}
        className="group relative flex-shrink-0 overflow-hidden border-2 border-slate-700 bg-slate-800 transition-colors hover:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        style={{
          width: previewPx,
          height: previewPx,
          borderRadius: isCircle ? '50%' : '0.5rem',
        }}
        aria-label="이미지 업로드"
      >
        {currentImageUrl ? (
          <img
            src={currentImageUrl}
            alt="캐릭터 이미지"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-slate-500">
            <Camera className="h-6 w-6" />
          </span>
        )}

        {/* Hover overlay */}
        <span
          className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        >
          <Camera className="h-5 w-5 text-white" />
        </span>
      </button>

      {/* Crop modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCancel}
        title="이미지 자르기"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={handleCancel} disabled={isUploading}>
              취소
            </Button>
            <Button onClick={handleConfirm} disabled={isUploading || !completedCrop}>
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  업로드 중…
                </>
              ) : (
                '확인'
              )}
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-slate-400">
            1:1 비율로 자를 영역을 선택하세요
            {isCircle && ' (원형으로 표시됩니다)'}
          </p>

          <div className="max-h-[400px] overflow-auto rounded-lg bg-slate-950 p-2">
            {srcUrl && (
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                circularCrop={isCircle}
                minWidth={50}
                minHeight={50}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
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
