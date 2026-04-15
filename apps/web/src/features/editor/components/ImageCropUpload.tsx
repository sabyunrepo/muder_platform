import { useState, useRef, useCallback } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/shared/components/ui/Modal';
import { Button } from '@/shared/components/ui/Button';
import { uploadImage } from '@/features/editor/imageApi';
import { getCroppedBlob, makeInitialCrop } from './cropUtils';

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

const PREVIEW_SIZE = { sm: 64, md: 96, lg: 128 } as const;
const CANVAS_OUTPUT_SIZE = 512;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB — must match backend MaxImageFileSize

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

  function handleClick() { fileInputRef.current?.click(); }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error('이미지 크기는 10MB 이하여야 합니다');
      return;
    }
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
    setCrop(makeInitialCrop(width, height, 1));
  }, []);

  async function handleConfirm() {
    if (!imgRef.current || !completedCrop) {
      toast.error('먼저 이미지를 자르세요');
      return;
    }
    setIsUploading(true);
    try {
      const { blob, contentType } = await getCroppedBlob(
        imgRef.current, completedCrop, CANVAS_OUTPUT_SIZE, CANVAS_OUTPUT_SIZE,
      );
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

  function handleCancel() { setModalOpen(false); setSrcUrl(null); }

  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      <button
        type="button"
        onClick={handleClick}
        className="group relative flex-shrink-0 overflow-hidden border-2 border-slate-700 bg-slate-800 transition-colors hover:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        style={{ width: previewPx, height: previewPx, borderRadius: isCircle ? '50%' : '0.5rem' }}
        aria-label="이미지 업로드"
      >
        {currentImageUrl ? (
          <img src={currentImageUrl} alt="캐릭터 이미지" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-slate-500">
            <Camera className="h-6 w-6" />
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true">
          <Camera className="h-5 w-5 text-white" />
        </span>
      </button>

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
          <p className="text-sm text-slate-400">
            1:1 비율로 자를 영역을 선택하세요{isCircle && ' (원형으로 표시됩니다)'}
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
