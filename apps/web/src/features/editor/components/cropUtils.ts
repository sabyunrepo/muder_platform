import { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CroppedBlobResult {
  blob: Blob;
  contentType: string;
}

// ---------------------------------------------------------------------------
// getCroppedBlob: draws pixelCrop onto a canvas and returns WebP (JPEG fallback)
// ---------------------------------------------------------------------------

export function getCroppedBlob(
  image: HTMLImageElement,
  pixelCrop: PixelCrop,
  outputWidth: number,
  outputHeight: number,
): Promise<CroppedBlobResult> {
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
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
    outputWidth,
    outputHeight,
  );

  return new Promise<CroppedBlobResult>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve({ blob, contentType: 'image/webp' });
        } else {
          // WebP not supported — fall back to JPEG
          canvas.toBlob(
            (jpegBlob) => {
              if (jpegBlob) resolve({ blob: jpegBlob, contentType: 'image/jpeg' });
              else reject(new Error('Canvas toBlob returned null'));
            },
            'image/jpeg',
            0.85,
          );
        }
      },
      'image/webp',
      0.85,
    );
  });
}

// ---------------------------------------------------------------------------
// makeInitialCrop: centered crop at given aspect ratio
// ---------------------------------------------------------------------------

export function makeInitialCrop(
  width: number,
  height: number,
  aspect: number,
): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, aspect, width, height),
    width,
    height,
  );
}
