import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { ImageCropUpload } from '../ImageCropUpload';

const { getCroppedBlobMock, uploadImageMock, toastErrorMock, toastSuccessMock } = vi.hoisted(
  () => ({
    getCroppedBlobMock: vi.fn(),
    uploadImageMock: vi.fn(),
    toastErrorMock: vi.fn(),
    toastSuccessMock: vi.fn(),
  })
);

vi.mock('react-image-crop', () => {
  function MockReactCrop({
    children,
    onComplete,
  }: {
    children: React.ReactNode;
    onComplete: (crop: { x: number; y: number; width: number; height: number; unit: 'px' }) => void;
  }) {
    const completed = useRef(false);
    useEffect(() => {
      if (completed.current) return;
      completed.current = true;
      onComplete({ x: 0, y: 0, width: 80, height: 80, unit: 'px' });
    }, [onComplete]);
    return <div data-testid="react-crop">{children}</div>;
  }

  return { default: MockReactCrop };
});

vi.mock('../cropUtils', () => ({
  getCroppedBlob: getCroppedBlobMock,
  makeInitialCrop: () => ({ unit: '%', x: 0, y: 0, width: 90, height: 90 }),
}));

vi.mock('@/features/editor/imageApi', () => ({
  uploadImage: uploadImageMock,
}));

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

class MockFileReader {
  result: string | ArrayBuffer | null = 'data:image/png;base64,ZmFrZQ==';
  onload: (() => void) | null = null;

  readAsDataURL() {
    this.onload?.();
  }
}

describe('ImageCropUpload', () => {
  beforeEach(() => {
    vi.stubGlobal('FileReader', MockFileReader);
    getCroppedBlobMock.mockResolvedValue({
      blob: new Blob(['cropped'], { type: 'image/webp' }),
      contentType: 'image/webp',
    });
    uploadImageMock.mockResolvedValue('https://cdn.example/character.webp');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('이미지 삭제 전 확인하고 승인 시 onRemoved를 호출한다', () => {
    const onRemoved = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <ImageCropUpload
        themeId="theme-1"
        targetId="char-1"
        target="character"
        currentImageUrl="https://cdn.example/old.webp"
        onUploaded={vi.fn()}
        onRemoved={onRemoved}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '이미지 삭제' }));

    expect(window.confirm).toHaveBeenCalledWith('이미지를 삭제할까요? 이 작업은 즉시 저장됩니다.');
    expect(onRemoved).toHaveBeenCalledOnce();
  });

  it('이미지 삭제 확인을 취소하면 onRemoved를 호출하지 않는다', () => {
    const onRemoved = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <ImageCropUpload
        themeId="theme-1"
        targetId="char-1"
        target="character"
        currentImageUrl="https://cdn.example/old.webp"
        onUploaded={vi.fn()}
        onRemoved={onRemoved}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '이미지 삭제' }));

    expect(onRemoved).not.toHaveBeenCalled();
  });

  it('10MB를 넘는 이미지는 업로드 모달을 열지 않고 오류를 표시한다', () => {
    const { container } = render(
      <ImageCropUpload
        themeId="theme-1"
        targetId="char-1"
        target="character"
        onUploaded={vi.fn()}
      />
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const largeFile = new File(['x'], 'large.png', { type: 'image/png' });
    Object.defineProperty(largeFile, 'size', { value: 10 * 1024 * 1024 + 1 });

    fireEvent.change(input, { target: { files: [largeFile] } });

    expect(toastErrorMock).toHaveBeenCalledWith('이미지 크기는 10MB 이하여야 합니다');
    expect(screen.queryByRole('dialog', { name: '이미지 자르기' })).toBeNull();
  });

  it('자르기 확인 시 이미지를 업로드하고 URL을 전달한다', async () => {
    const onUploaded = vi.fn();
    const { container } = render(
      <ImageCropUpload
        themeId="theme-1"
        targetId="char-1"
        target="character"
        onUploaded={onUploaded}
      />
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(['image'], 'character.png', { type: 'image/png' })] },
    });
    fireEvent.click(await screen.findByRole('button', { name: '확인' }));

    await waitFor(() => {
      expect(uploadImageMock).toHaveBeenCalledWith(
        'theme-1',
        'character',
        'char-1',
        expect.any(Blob),
        'image/webp'
      );
    });
    expect(onUploaded).toHaveBeenCalledWith('https://cdn.example/character.webp');
    expect(toastSuccessMock).toHaveBeenCalledWith('이미지가 업로드되었습니다');
  });
});
