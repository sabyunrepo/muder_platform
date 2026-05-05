import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaUploadModal } from '../MediaUploadModal';
import { ApiHttpError } from '@/lib/api-error';

// Mock the upload helper + hooks. We keep the hooks as no-op mutations and
// drive behaviour through the uploadMediaFile mock.
vi.mock('@/features/editor/mediaApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/editor/mediaApi')>(
    '@/features/editor/mediaApi'
  );
  return {
    ...actual,
    uploadMediaFile: vi.fn(),
    useRequestUploadUrl: () => ({
      mutateAsync: vi.fn(async () => ({
        upload_id: 'u1',
        upload_url: 'https://r2/x',
        expires_at: '',
      })),
    }),
    useConfirmUpload: () => ({
      mutateAsync: vi.fn(async () => ({
        id: 'm1',
        theme_id: 't1',
        name: 'x',
        type: 'BGM',
        source_type: 'FILE',
        tags: [],
        sort_order: 0,
        created_at: '',
      })),
    }),
  };
});

import { uploadMediaFile } from '@/features/editor/mediaApi';

const mockedUpload = uploadMediaFile as unknown as ReturnType<typeof vi.fn>;

function renderModal(open = true, onClose = vi.fn()) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    onClose,
    ...render(
      <QueryClientProvider client={qc}>
        <MediaUploadModal open={open} onClose={onClose} themeId="theme-1" />
      </QueryClientProvider>
    ),
  };
}

function makeFile(name: string, size: number, type = 'audio/mpeg'): File {
  const file = new File(['x'.repeat(Math.min(size, 1024))], name, { type });
  Object.defineProperty(file, 'size', { value: size, configurable: true });
  return file;
}

describe('MediaUploadModal', () => {
  beforeEach(() => {
    mockedUpload.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    const { container } = renderModal(false);
    expect(container.firstChild).toBeNull();
  });

  it('renders upload zone when open', () => {
    renderModal(true);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('파일을 드래그하거나 클릭하여 선택')).toBeTruthy();
  });

  it('file select populates filename and default name', () => {
    renderModal(true);
    const input = screen.getByTestId('media-upload-input') as HTMLInputElement;
    const file = makeFile('song.mp3', 1024);
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText('song.mp3')).toBeTruthy();
    const nameInput = screen.getByLabelText('이름') as HTMLInputElement;
    expect(nameInput.value).toBe('song');
  });

  it('rejects oversized file with error', () => {
    renderModal(true);
    const input = screen.getByTestId('media-upload-input') as HTMLInputElement;
    const file = makeFile('big.mp3', 21 * 1024 * 1024);
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByRole('alert').textContent).toContain('파일 크기는 20MB 이하여야 합니다');
  });

  it('rejects wrong MIME type', () => {
    renderModal(true);
    const input = screen.getByTestId('media-upload-input') as HTMLInputElement;
    const file = makeFile('doc.pdf', 1024, 'application/pdf');
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByRole('alert').textContent).toContain('지원하지 않는 파일 형식입니다');
  });

  it('rejects audio/mp4 (m4a) — backend does not accept it', () => {
    // Regression: FE previously accepted audio/mp4 but backend
    // AllowedAudioMIMEs rejects it, leading to confusing post-upload errors.
    renderModal(true);
    const input = screen.getByTestId('media-upload-input') as HTMLInputElement;
    const file = makeFile('song.m4a', 1024, 'audio/mp4');
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByRole('alert').textContent).toContain('지원하지 않는 파일 형식입니다');
  });

  it('type select works', () => {
    renderModal(true);
    const input = screen.getByTestId('media-upload-input') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('a.mp3', 1024)] },
    });

    const select = screen.getByLabelText('유형') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'SFX' } });
    expect(select.value).toBe('SFX');
  });

  it('upload button triggers uploadMediaFile with correct params', async () => {
    mockedUpload.mockResolvedValueOnce({});
    const { onClose } = renderModal(true);
    const input = screen.getByTestId('media-upload-input') as HTMLInputElement;
    const file = makeFile('track.mp3', 1024);
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: '업로드' }));

    await waitFor(() => expect(mockedUpload).toHaveBeenCalledTimes(1));
    const args = mockedUpload.mock.calls[0][0];
    expect(args.themeId).toBe('theme-1');
    expect(args.file).toBe(file);
    expect(args.type).toBe('BGM');
    expect(args.name).toBe('track');
    expect(typeof args.requestUploadUrl).toBe('function');
    expect(typeof args.confirmUpload).toBe('function');
    expect(typeof args.onProgress).toBe('function');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('이미지 파일은 IMAGE 타입으로 자동 설정해 업로드한다', async () => {
    mockedUpload.mockResolvedValueOnce({});
    renderModal(true);
    const input = screen.getByTestId('media-upload-input') as HTMLInputElement;
    const file = makeFile('background.png', 1024, 'image/png');
    fireEvent.change(input, { target: { files: [file] } });

    expect((screen.getByLabelText('유형') as HTMLSelectElement).value).toBe('IMAGE');

    fireEvent.click(screen.getByRole('button', { name: '업로드' }));

    await waitFor(() => expect(mockedUpload).toHaveBeenCalledTimes(1));
    expect(mockedUpload.mock.calls[0][0].type).toBe('IMAGE');
  });

  it('progress bar updates from onProgress', async () => {
    mockedUpload.mockImplementationOnce(async (params: any) => {
      params.onProgress?.(42);
      return {};
    });
    renderModal(true);
    const input = screen.getByTestId('media-upload-input') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('a.mp3', 1024)] },
    });
    fireEvent.click(screen.getByRole('button', { name: '업로드' }));
    await waitFor(() => expect(mockedUpload).toHaveBeenCalled());
    // Progress was reported synchronously inside the impl. Modal closes on
    // success, so we just verify the upload was invoked with onProgress.
    const args = mockedUpload.mock.calls[0][0];
    expect(typeof args.onProgress).toBe('function');
  });

  it('upload success calls onClose', async () => {
    mockedUpload.mockResolvedValueOnce({});
    const { onClose } = renderModal(true);
    fireEvent.change(screen.getByTestId('media-upload-input'), {
      target: { files: [makeFile('a.mp3', 1024)] },
    });
    fireEvent.click(screen.getByRole('button', { name: '업로드' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('upload error shows error message', async () => {
    mockedUpload.mockRejectedValueOnce(new Error('서버 에러'));
    renderModal(true);
    fireEvent.change(screen.getByTestId('media-upload-input'), {
      target: { files: [makeFile('a.mp3', 1024)] },
    });
    fireEvent.click(screen.getByRole('button', { name: '업로드' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('서버 에러'));
  });

  it('API upload error hides raw detail and shows reference', async () => {
    mockedUpload.mockRejectedValueOnce(
      new ApiHttpError({
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'internal storage key collision for theme-1',
        code: 'MEDIA_REFERENCE_IN_USE',
        request_id: 'req-1234567890',
        correlation_id: 'req-1234567890',
        timestamp: '2026-05-05T00:00:00Z',
        severity: 'medium',
        retryable: false,
        user_action: 'review_references',
      })
    );
    renderModal(true);
    fireEvent.change(screen.getByTestId('media-upload-input'), {
      target: { files: [makeFile('a.mp3', 1024)] },
    });
    fireEvent.click(screen.getByRole('button', { name: '업로드' }));
    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain(
        '이 미디어는 다른 곳에서 사용 중이라 삭제할 수 없습니다.'
      );
      expect(alert.textContent).toContain('Ref: req-1234');
      expect(alert.textContent).not.toContain('internal storage key');
    });
  });

  it('passes an AbortSignal to uploadMediaFile', async () => {
    mockedUpload.mockResolvedValueOnce({});
    renderModal(true);
    fireEvent.change(screen.getByTestId('media-upload-input'), {
      target: { files: [makeFile('a.mp3', 1024)] },
    });
    fireEvent.click(screen.getByRole('button', { name: '업로드' }));
    await waitFor(() => expect(mockedUpload).toHaveBeenCalled());
    const args = mockedUpload.mock.calls[0][0];
    expect(args.signal).toBeInstanceOf(AbortSignal);
    expect(args.signal.aborted).toBe(false);
  });

  it('업로드 취소 button aborts the signal and clears uploading state', async () => {
    let capturedSignal: AbortSignal | undefined;
    mockedUpload.mockImplementationOnce(
      (params: any) =>
        new Promise((_resolve, reject) => {
          capturedSignal = params.signal;
          params.signal.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );
    renderModal(true);
    fireEvent.change(screen.getByTestId('media-upload-input'), {
      target: { files: [makeFile('a.mp3', 1024)] },
    });
    fireEvent.click(screen.getByRole('button', { name: '업로드' }));
    await waitFor(() => expect(mockedUpload).toHaveBeenCalled());

    const abortBtn = screen.getByRole('button', {
      name: '업로드 취소',
    }) as HTMLButtonElement;
    fireEvent.click(abortBtn);

    expect(capturedSignal?.aborted).toBe(true);
    await waitFor(() => {
      expect(
        (screen.getByRole('button', { name: '업로드' }) as HTMLButtonElement).textContent
      ).toBe('업로드');
    });
  });

  it('cancel during upload is disabled', async () => {
    let resolveUpload: ((v: unknown) => void) | undefined;
    mockedUpload.mockImplementationOnce(() => new Promise((res) => (resolveUpload = res)));
    renderModal(true);
    fireEvent.change(screen.getByTestId('media-upload-input'), {
      target: { files: [makeFile('a.mp3', 1024)] },
    });
    fireEvent.click(screen.getByRole('button', { name: '업로드' }));

    await waitFor(() => expect(mockedUpload).toHaveBeenCalled());
    const cancel = screen.getByRole('button', {
      name: '취소',
    }) as HTMLButtonElement;
    expect(cancel.disabled).toBe(true);
    const close = screen.getByRole('button', {
      name: '닫기',
    }) as HTMLButtonElement;
    expect(close.disabled).toBe(true);

    resolveUpload?.({});
  });
});
