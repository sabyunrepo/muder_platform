import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  useMediaListMock,
  useUpdateMediaMock,
  useDeleteMediaMock,
  useRequestUploadUrlMock,
  useConfirmUploadMock,
  useCreateYouTubeMediaMock,
  toastSuccess,
  toastError,
} = vi.hoisted(() => ({
  useMediaListMock: vi.fn(),
  useUpdateMediaMock: vi.fn(),
  useDeleteMediaMock: vi.fn(),
  useRequestUploadUrlMock: vi.fn(),
  useConfirmUploadMock: vi.fn(),
  useCreateYouTubeMediaMock: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/features/editor/mediaApi', () => ({
  useMediaList: (...args: unknown[]) => useMediaListMock(...args),
  useUpdateMedia: () => useUpdateMediaMock(),
  useDeleteMedia: () => useDeleteMediaMock(),
  useRequestUploadUrl: () => useRequestUploadUrlMock(),
  useConfirmUpload: () => useConfirmUploadMock(),
  useCreateYouTubeMedia: () => useCreateYouTubeMediaMock(),
}));

vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError },
}));

// HTMLAudioElement isn't available in JSDOM by default for our needs;
// stub it so usePreviewPlayer can construct without throwing.
class FakeAudio {
  src = '';
  paused = true;
  addEventListener() {}
  removeEventListener() {}
  pause() {}
  play() {
    return Promise.resolve();
  }
}
// @ts-expect-error — install fake constructor
globalThis.Audio = FakeAudio;

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { MediaTab } from '../MediaTab';
import type { MediaResponse } from '@/features/editor/mediaApi';
import { ApiHttpError } from '@/lib/api-error';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockMedia: MediaResponse[] = [
  {
    id: 'media-1',
    theme_id: 'theme-1',
    name: '오프닝 BGM',
    type: 'BGM',
    source_type: 'FILE',
    url: 'https://example.com/bgm.mp3',
    duration: 125,
    file_size: 1234567,
    mime_type: 'audio/mpeg',
    tags: ['오프닝'],
    sort_order: 1,
    created_at: '2026-04-05T00:00:00Z',
  },
  {
    id: 'media-2',
    theme_id: 'theme-1',
    name: '문 닫는 소리',
    type: 'SFX',
    source_type: 'FILE',
    url: 'https://example.com/sfx.mp3',
    duration: 3,
    file_size: 1024,
    mime_type: 'audio/mpeg',
    tags: [],
    sort_order: 2,
    created_at: '2026-04-05T00:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mutationStub() {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  useUpdateMediaMock.mockReturnValue(mutationStub());
  useDeleteMediaMock.mockReturnValue(mutationStub());
  useRequestUploadUrlMock.mockReturnValue(mutationStub());
  useConfirmUploadMock.mockReturnValue(mutationStub());
  useCreateYouTubeMediaMock.mockReturnValue(mutationStub());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// =========================================================================
// MediaTab
// =========================================================================

describe('MediaTab', () => {
  it('로딩 중일 때 스피너를 표시한다', () => {
    useMediaListMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(<MediaTab themeId="theme-1" />);
    expect(screen.getByRole('status', { name: '미디어 로딩 중' })).toBeDefined();
  });

  it('미디어가 없을 때 빈 상태를 표시한다', () => {
    useMediaListMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    render(<MediaTab themeId="theme-1" />);
    expect(screen.getByText('미디어 없음')).toBeDefined();
  });

  it('미디어 카드 목록을 렌더링한다', () => {
    useMediaListMock.mockReturnValue({
      data: mockMedia,
      isLoading: false,
      isError: false,
    });

    render(<MediaTab themeId="theme-1" />);
    expect(screen.getByText('오프닝 BGM')).toBeDefined();
    expect(screen.getByText('문 닫는 소리')).toBeDefined();
    // Type badges — "BGM" also appears in toolbar pill, so use getAllByText
    expect(screen.getAllByText('BGM').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('SFX').length).toBeGreaterThanOrEqual(1);
    // Duration formatted mm:ss
    expect(screen.getByText('2:05')).toBeDefined();
    expect(screen.getByText('0:03')).toBeDefined();
  });

  it('필터 변경 시 useMediaList를 새로운 타입으로 호출한다', () => {
    useMediaListMock.mockReturnValue({
      data: mockMedia,
      isLoading: false,
      isError: false,
    });

    render(<MediaTab themeId="theme-1" />);

    // 초기에는 'all' → undefined
    expect(useMediaListMock).toHaveBeenLastCalledWith('theme-1', undefined);

    // BGM 필터 클릭 — pill button (효과음/음성과 분리되도록 BGM 정확 매칭)
    const bgmPill = screen.getByRole('button', { name: 'BGM', pressed: false });
    fireEvent.click(bgmPill);

    expect(useMediaListMock).toHaveBeenLastCalledWith('theme-1', 'BGM');
  });

  it('카드 클릭 시 상세 패널이 열린다', () => {
    useMediaListMock.mockReturnValue({
      data: mockMedia,
      isLoading: false,
      isError: false,
    });

    render(<MediaTab themeId="theme-1" />);

    // Detail not visible
    expect(screen.queryByText('미디어 상세')).toBeNull();

    // Click first card — name text is inside button
    const card = screen.getByText('오프닝 BGM').closest("[role='button']") as HTMLElement | null;
    expect(card).not.toBeNull();
    fireEvent.click(card!);

    // Detail visible
    expect(screen.getByText('미디어 상세')).toBeDefined();
    // Editable name input pre-filled
    expect(screen.getByDisplayValue('오프닝 BGM')).toBeDefined();
  });

  it('상세 닫기 버튼이 선택을 해제한다', () => {
    useMediaListMock.mockReturnValue({
      data: mockMedia,
      isLoading: false,
      isError: false,
    });

    render(<MediaTab themeId="theme-1" />);

    // Open detail
    const card = screen.getByText('오프닝 BGM').closest("[role='button']") as HTMLElement | null;
    fireEvent.click(card!);
    expect(screen.getByText('미디어 상세')).toBeDefined();

    // Close
    const closeBtn = screen.getByRole('button', { name: '상세 닫기' });
    fireEvent.click(closeBtn);

    expect(screen.queryByText('미디어 상세')).toBeNull();
  });

  it('참조 중인 미디어 삭제가 차단되면 제작 위치를 상세 패널에 표시한다', async () => {
    useMediaListMock.mockReturnValue({
      data: mockMedia,
      isLoading: false,
      isError: false,
    });
    const deleteMutation = {
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockRejectedValue(
        new ApiHttpError({
          status: 409,
          title: 'Conflict',
          detail: 'media is referenced by editor content',
          code: 'MEDIA_REFERENCE_IN_USE',
          params: {
            references: [
              {
                type: 'phase_action',
                id: 'phase-open:onEnter:0',
                name: '오프닝 시작 트리거에서 BGM으로 사용 중',
              },
              {
                type: 'event_progression_trigger_action',
                id: 'trigger-secret-room:0',
                name: '비밀 토론방 공개 실행 결과에서 배경 이미지로 사용 중',
              },
            ],
          },
        })
      ),
      isPending: false,
    };
    useDeleteMediaMock.mockReturnValue(deleteMutation);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    try {
      render(<MediaTab themeId="theme-1" />);

      const card = screen.getByText('오프닝 BGM').closest("[role='button']") as HTMLElement | null;
      fireEvent.click(card!);
      fireEvent.click(screen.getByRole('button', { name: '삭제' }));

      const warning = await screen.findByRole('alert');
      expect(warning.textContent).toContain('이 미디어는 아직 삭제할 수 없습니다.');
      expect(screen.getByText(/단계 연출/)).toBeDefined();
      expect(screen.getByText(/오프닝 시작 트리거에서 BGM으로 사용 중/)).toBeDefined();
      expect(screen.getByText(/트리거 연출/)).toBeDefined();
      expect(
        screen.getByText(/비밀 토론방 공개 실행 결과에서 배경 이미지로 사용 중/)
      ).toBeDefined();
      expect(screen.queryByText(/phase-open/)).toBeNull();
      expect(screen.queryByText(/trigger-secret-room/)).toBeNull();
      expect(toastSuccess).not.toHaveBeenCalled();
      expect(alertSpy).not.toHaveBeenCalled();
    } finally {
      confirmSpy.mockRestore();
      alertSpy.mockRestore();
    }
  });

  it('업로드와 YouTube 버튼이 렌더링된다', () => {
    useMediaListMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    render(<MediaTab themeId="theme-1" />);

    // D3/D4 will hook actual modals; for now just verify buttons exist & clickable
    const uploadBtn = screen.getByRole('button', { name: /파일 업로드/ });
    const ytBtn = screen.getByRole('button', { name: /YouTube/ });
    expect(uploadBtn).toBeDefined();
    expect(ytBtn).toBeDefined();
    fireEvent.click(uploadBtn);
    fireEvent.click(ytBtn);
  });

  it('에러 발생 시 에러 메시지를 표시한다', () => {
    useMediaListMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(<MediaTab themeId="theme-1" />);
    expect(screen.getByText('미디어 목록을 불러오지 못했습니다')).toBeDefined();
  });
});
