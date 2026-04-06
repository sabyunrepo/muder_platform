import { Suspense, lazy, useState, useCallback } from "react";
import type { Area } from "react-easy-crop";
import { Spinner } from "@/shared/components/ui/Spinner";
import { Modal } from "@/shared/components/ui/Modal";
import { Button } from "@/shared/components/ui/Button";

const Cropper = lazy(() => import("react-easy-crop"));

// ---------------------------------------------------------------------------
// Canvas crop helper
// ---------------------------------------------------------------------------

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.setAttribute("crossOrigin", "anonymous");
    img.src = url;
  });
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    256,
    256,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob 실패"));
      },
      "image/webp",
      0.8,
    );
  });
}

// ---------------------------------------------------------------------------
// AvatarCropModal
// ---------------------------------------------------------------------------

interface AvatarCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  onClose: () => void;
  onApply: (blob: Blob) => void;
}

export function AvatarCropModal({
  isOpen,
  imageSrc,
  onClose,
  onApply,
}: AvatarCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleApply = useCallback(async () => {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
      onApply(blob);
      onClose();
    } catch {
      // 실패 시 모달 유지
    } finally {
      setIsProcessing(false);
    }
  }, [croppedAreaPixels, imageSrc, onApply, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="아바타 크롭"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isProcessing}>
            취소
          </Button>
          <Button onClick={handleApply} isLoading={isProcessing}>
            적용
          </Button>
        </>
      }
    >
      {/* 크롭 영역: 고정 높이 */}
      <div className="relative h-72 w-full overflow-hidden rounded-lg bg-slate-950">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center">
              <Spinner size="lg" />
            </div>
          }
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </Suspense>
      </div>

      {/* 줌 슬라이더 */}
      <div className="mt-4 flex items-center gap-3">
        <span className="text-xs text-slate-500">축소</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-amber-500"
          aria-label="줌 조절"
        />
        <span className="text-xs text-slate-500">확대</span>
      </div>
    </Modal>
  );
}
