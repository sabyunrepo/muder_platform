import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  useMediaListMock,
  useMediaCategoriesMock,
  useCreateMediaCategoryMock,
  useDeleteMediaCategoryMock,
  useUpdateMediaMock,
  useDeleteMediaMock,
  useRequestUploadUrlMock,
  useConfirmUploadMock,
  useCreateYouTubeMediaMock,
  toastSuccess,
  toastError,
} = vi.hoisted(() => ({
  useMediaListMock: vi.fn(),
  useMediaCategoriesMock: vi.fn(),
  useCreateMediaCategoryMock: vi.fn(),
  useDeleteMediaCategoryMock: vi.fn(),
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
  useMediaCategories: (...args: unknown[]) => useMediaCategoriesMock(...args),
  useCreateMediaCategory: () => useCreateMediaCategoryMock(),
  useDeleteMediaCategory: () => useDeleteMediaCategoryMock(),
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
  useMediaCategoriesMock.mockReturnValue({
    data: [
      {
        id: 'category-screen',
        theme_id: 'theme-1',
        name: '스크린',
        sort_order: 1,
        created_at: '2026-04-05T00:00:00Z',
      },
    ],
  });
  useCreateMediaCategoryMock.mockReturnValue(mutationStub());
  useDeleteMediaCategoryMock.mockReturnValue(mutationStub());
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
    // Type badges render creator-facing labels on cards.
    expect(screen.getAllByText('배경음악').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('효과음').length).toBeGreaterThanOrEqual(1);
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
    expect(useMediaListMock).toHaveBeenLastCalledWith('theme-1', undefined, undefined);

    // BGM 필터 클릭 — pill button (효과음/음성과 분리되도록 BGM 정확 매칭)
    const bgmPill = screen.getByRole('button', { name: 'BGM', pressed: false });
    fireEvent.click(bgmPill);

    expect(useMediaListMock).toHaveBeenLastCalledWith('theme-1', 'BGM', undefined);
  });

  it('카테고리와 검색 필터를 함께 적용한다', () => {
    useMediaListMock.mockReturnValue({
      data: mockMedia,
      isLoading: false,
      isError: false,
    });

    render(<MediaTab themeId="theme-1" />);

    fireEvent.click(screen.getByRole('button', { name: '스크린', pressed: false }));
    expect(useMediaListMock).toHaveBeenLastCalledWith('theme-1', undefined, 'category-screen');

    fireEvent.change(screen.getByLabelText('미디어 검색'), { target: { value: '문 닫는' } });
    expect(screen.queryByText('오프닝 BGM')).toBeNull();
    expect(screen.getByText('문 닫는 소리')).toBeDefined();
  });

  it('선택한 카테고리를 삭제하면 전체 카테고리로 돌아간다', () => {
    useMediaListMock.mockReturnValue({
      data: mockMedia,
      isLoading: false,
      isError: false,
    });
    const mutate = vi.fn((_id: string, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });
    useDeleteMediaCategoryMock.mockReturnValue({
      mutate,
      mutateAsync: vi.fn(),
      isPending: false,
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    try {
      render(<MediaTab themeId="theme-1" />);

      fireEvent.click(screen.getByRole('button', { name: '스크린', pressed: false }));
      fireEvent.click(screen.getByRole('button', { name: /카테고리 삭제/ }));

      expect(mutate).toHaveBeenCalledWith('category-screen', expect.any(Object));
      const categoryGroup = screen.getByRole('group', { name: '미디어 카테고리 필터' });
      expect(within(categoryGroup).getByRole('button', { name: '전체', pressed: true })).toBeDefined();
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it('새 카테고리는 기존 sort_order 최댓값 다음 순서로 생성한다', () => {
    useMediaListMock.mockReturnValue({
      data: mockMedia,
      isLoading: false,
      isError: false,
    });
    useMediaCategoriesMock.mockReturnValue({
      data: [
        {
          id: 'category-screen',
          theme_id: 'theme-1',
          name: '스크린',
          sort_order: 1,
          created_at: '2026-04-05T00:00:00Z',
        },
        {
          id: 'category-clue',
          theme_id: 'theme-1',
          name: '단서',
          sort_order: 7,
          created_at: '2026-04-05T00:00:00Z',
        },
      ],
    });
    const mutate = vi.fn();
    useCreateMediaCategoryMock.mockReturnValue({
      mutate,
      mutateAsync: vi.fn(),
      isPending: false,
    });
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('증거 사진');

    try {
      render(<MediaTab themeId="theme-1" />);

      fireEvent.click(screen.getByRole('button', { name: '카테고리' }));

      expect(mutate).toHaveBeenCalledWith({
        name: '증거 사진',
        sort_order: 8,
      });
    } finally {
      promptSpy.mockRestore();
    }
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
    expect(screen.getByText('미디어 상세').closest('aside')?.className).toContain('lg:overflow-y-auto');
    // Editable name input pre-filled
    expect(screen.getByDisplayValue('오프닝 BGM')).toBeDefined();
    expect(screen.getByText('분류')).toBeDefined();
    expect(screen.getAllByText('배경음악').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('출처')).toBeDefined();
    expect(screen.getByText('직접 업로드')).toBeDefined();
    expect(screen.getByText('파일 형식')).toBeDefined();
    expect(screen.getByText('MP3')).toBeDefined();
    expect(screen.getByText('파일 크기')).toBeDefined();
    expect(screen.getByText('1.2 MB')).toBeDefined();
    expect(screen.queryByText('type: BGM')).toBeNull();
    expect(screen.queryByText('source: FILE')).toBeNull();
    expect(screen.queryByText('mime: audio/mpeg')).toBeNull();
    expect(screen.queryByText('size: 1234567 B')).toBeNull();
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
