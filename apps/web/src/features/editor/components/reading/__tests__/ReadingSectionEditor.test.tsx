import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  act,
  within,
} from '@testing-library/react';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  useUpdateReadingSectionMock,
  useDeleteReadingSectionMock,
  useMediaListMock,
  useMediaCategoriesMock,
  useRequestUploadUrlMock,
  useConfirmUploadMock,
  invalidateQueriesMock,
  writeTextMock,
} = vi.hoisted(() => ({
  useUpdateReadingSectionMock: vi.fn(),
  useDeleteReadingSectionMock: vi.fn(),
  useMediaListMock: vi.fn(),
  useMediaCategoriesMock: vi.fn(),
  useRequestUploadUrlMock: vi.fn(),
  useConfirmUploadMock: vi.fn(),
  invalidateQueriesMock: vi.fn(),
  writeTextMock: vi.fn(),
}));

vi.mock('@/features/editor/readingApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/editor/readingApi')>(
    '@/features/editor/readingApi'
  );
  return {
    ...actual,
    useUpdateReadingSection: () => useUpdateReadingSectionMock(),
    useDeleteReadingSection: () => useDeleteReadingSectionMock(),
  };
});

vi.mock('@/features/editor/mediaApi', () => ({
  useMediaList: (...args: unknown[]) => useMediaListMock(...args),
  useMediaCategories: (...args: unknown[]) => useMediaCategoriesMock(...args),
  useRequestUploadUrl: (...args: unknown[]) => useRequestUploadUrlMock(...args),
  useConfirmUpload: (...args: unknown[]) => useConfirmUploadMock(...args),
}));

vi.mock('@/services/queryClient', () => ({
  queryClient: {
    invalidateQueries: invalidateQueriesMock,
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { ReadingSectionEditor } from '../ReadingSectionEditor';
import { computeSmartAdvanceBy } from '../advanceByDefaults';
import type { ReadingSectionResponse } from '@/features/editor/readingApi';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sampleSection: ReadingSectionResponse = {
  id: 'sec-1',
  themeId: 'theme-1',
  name: '오프닝',
  bgmMediaId: null,
  sortOrder: 0,
  version: 3,
  createdAt: '2026-04-05T00:00:00Z',
  updatedAt: '2026-04-05T00:00:00Z',
  lines: [
    {
      Index: 0,
      Text: '어두운 방 안.',
      Speaker: '나레이션',
      VoiceMediaID: '',
      ImageMediaID: '',
      AdvanceBy: 'gm',
    },
    {
      Index: 1,
      Text: '누구냐?',
      Speaker: 'Alice',
      VoiceMediaID: '',
      ImageMediaID: '',
      AdvanceBy: 'role:c1',
    },
  ],
};

const characters = [
  { id: 'c1', name: 'Alice' },
  { id: 'c2', name: 'Bob' },
];

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let mutateAsyncUpdate: ReturnType<typeof vi.fn>;
let mutateAsyncDelete: ReturnType<typeof vi.fn>;

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Object.assign(navigator, {
    clipboard: {
      writeText: writeTextMock,
    },
  });
  writeTextMock.mockResolvedValue(undefined);
  mutateAsyncUpdate = vi.fn().mockResolvedValue(sampleSection);
  mutateAsyncDelete = vi.fn().mockResolvedValue(undefined);

  useUpdateReadingSectionMock.mockReturnValue({
    mutateAsync: mutateAsyncUpdate,
    isPending: false,
  });
  useDeleteReadingSectionMock.mockReturnValue({
    mutateAsync: mutateAsyncDelete,
    isPending: false,
  });
  useMediaListMock.mockReturnValue({ data: [], isLoading: false });
  useMediaCategoriesMock.mockReturnValue({ data: [] });
  useRequestUploadUrlMock.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  });
  useConfirmUploadMock.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Smart defaults — pure function
// ---------------------------------------------------------------------------

describe('computeSmartAdvanceBy', () => {
  it('narration → gm', () => {
    expect(computeSmartAdvanceBy({ Speaker: '나레이션' }, true, characters)).toBe('gm');
  });

  it('voice attached → voice', () => {
    expect(
      computeSmartAdvanceBy({ Speaker: 'Alice', VoiceMediaID: 'm-1' }, false, characters)
    ).toBe('voice');
  });

  it('character speaker → role:<character.id>', () => {
    // Speaker is a display name; resolved to the stable character id so the
    // advance permission check on the server (which compares role ids) works.
    expect(computeSmartAdvanceBy({ Speaker: 'Alice' }, false, characters)).toBe('role:c1');
    expect(computeSmartAdvanceBy({ Speaker: 'Bob' }, false, characters)).toBe('role:c2');
  });

  it('unknown speaker (no matching character) → gm fallback', () => {
    expect(computeSmartAdvanceBy({ Speaker: 'Nobody' }, false, characters)).toBe('gm');
  });

  it('empty fallback → gm', () => {
    expect(computeSmartAdvanceBy({}, false, characters)).toBe('gm');
  });
});

// ---------------------------------------------------------------------------
// ReadingSectionEditor
// ---------------------------------------------------------------------------

describe('ReadingSectionEditor', () => {
  function renderEditor(overrides?: Partial<React.ComponentProps<typeof ReadingSectionEditor>>) {
    return render(
      <ReadingSectionEditor
        themeId="theme-1"
        section={sampleSection}
        characters={characters}
        {...overrides}
      />
    );
  }

  it('renders section name as editable input', () => {
    renderEditor();
    const input = screen.getByLabelText('섹션 이름') as HTMLInputElement;
    expect(input.value).toBe('오프닝');
  });

  it('renders all line rows', () => {
    renderEditor();
    expect(screen.getByDisplayValue('어두운 방 안.')).toBeTruthy();
    expect(screen.getByDisplayValue('누구냐?')).toBeTruthy();
  });

  it('add dialogue block appends a new empty row', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: '대사' }));
    expect(screen.getByText(/대본 블록 \(3개\)/)).toBeTruthy();
  });

  it('delete block removes a row', () => {
    renderEditor();
    const deleteButtons = screen.getAllByLabelText('블록 삭제');
    fireEvent.click(deleteButtons[0]);
    expect(screen.queryByDisplayValue('어두운 방 안.')).toBeNull();
  });

  it('editing line text updates draft', () => {
    renderEditor();
    const ta = screen.getByDisplayValue('어두운 방 안.') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: '변경된 지문' } });
    expect((screen.getByDisplayValue('변경된 지문') as HTMLTextAreaElement).value).toBe(
      '변경된 지문'
    );
  });

  it('changing speaker updates the line', () => {
    renderEditor();
    const speakerSelects = screen.getAllByLabelText('화자');
    fireEvent.change(speakerSelects[0], { target: { value: 'Bob' } });
    expect((speakerSelects[0] as HTMLSelectElement).value).toBe('Bob');
  });

  it('save calls useUpdateReadingSection with version + patch', async () => {
    renderEditor();
    const input = screen.getByLabelText('섹션 이름') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '재명명' } });

    const saveBtn = screen.getByRole('button', { name: /저장/ });
    fireEvent.click(saveBtn);

    await waitFor(() => expect(mutateAsyncUpdate).toHaveBeenCalledTimes(1));
    const callArg = mutateAsyncUpdate.mock.calls[0][0];
    expect(callArg.id).toBe('sec-1');
    expect(callArg.patch.version).toBe(3);
    expect(callArg.patch.name).toBe('재명명');
    expect(Array.isArray(callArg.patch.lines)).toBe(true);
  });

  it('line image picker stores an IMAGE media reference', async () => {
    useMediaListMock.mockImplementation((_themeId: string, type?: string) => {
      if (type === 'IMAGE') {
        return {
          data: [
            {
              id: 'image-1',
              theme_id: 'theme-1',
              name: '현장 사진',
              type: 'IMAGE',
              source_type: 'FILE',
              url: 'https://example.com/image.png',
              tags: [],
              sort_order: 1,
              created_at: '2026-04-05T00:00:00Z',
            },
          ],
          isLoading: false,
        };
      }
      return { data: [], isLoading: false };
    });

    renderEditor();
    fireEvent.click(screen.getAllByRole('button', { name: '이미지 선택' })[0]);

    expect(useMediaListMock).toHaveBeenCalledWith('theme-1', 'IMAGE');
    expect(screen.getByText(/이미지 유형만 표시됩니다/)).toBeTruthy();
    fireEvent.click(screen.getByText('현장 사진').closest('button') as HTMLElement);

    expect(screen.getByText('현장 사진')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /저장/ }));

    await waitFor(() => expect(mutateAsyncUpdate).toHaveBeenCalledTimes(1));
    expect(mutateAsyncUpdate.mock.calls[0][0].patch.lines[0].ImageMediaID).toBe('image-1');
  });

  it('line image picker serializes cleared image references', async () => {
    useMediaListMock.mockImplementation((_themeId: string, type?: string) => {
      if (type === 'IMAGE') {
        return {
          data: [
            {
              id: 'image-1',
              theme_id: 'theme-1',
              name: '현장 사진',
              type: 'IMAGE',
              source_type: 'FILE',
              url: 'https://example.com/image.png',
              tags: [],
              sort_order: 1,
              created_at: '2026-04-05T00:00:00Z',
            },
          ],
          isLoading: false,
        };
      }
      return { data: [], isLoading: false };
    });

    renderEditor({
      section: {
        ...sampleSection,
        lines: [{ ...sampleSection.lines[0], ImageMediaID: 'image-1' }],
      },
    });

    expect(screen.getByText('현장 사진')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '이미지 제거' }));
    fireEvent.click(screen.getByRole('button', { name: /저장/ }));

    await waitFor(() => expect(mutateAsyncUpdate).toHaveBeenCalledTimes(1));
    expect(mutateAsyncUpdate.mock.calls[0][0].patch.lines[0].ImageMediaID).toBe('');
  });

  it('imports pasted script into ordered reading blocks', async () => {
    useMediaListMock.mockImplementation((_themeId: string, type?: string) => {
      if (type === 'IMAGE') {
        return {
          data: [
            {
              id: 'image-1',
              theme_id: 'theme-1',
              name: '현장 사진',
              type: 'IMAGE',
              source_type: 'FILE',
              url: 'https://example.com/image.png',
              tags: [],
              sort_order: 1,
              created_at: '2026-04-05T00:00:00Z',
            },
          ],
          isLoading: false,
        };
      }
      if (type === 'BGM') {
        return {
          data: [
            {
              id: 'bgm-1',
              theme_id: 'theme-1',
              name: '심문 테마',
              type: 'BGM',
              source_type: 'FILE',
              tags: [],
              sort_order: 2,
              created_at: '2026-04-05T00:00:00Z',
            },
          ],
          isLoading: false,
        };
      }
      return { data: [], isLoading: false };
    });

    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: '대본 입력' }));
    fireEvent.change(screen.getByLabelText('대본 입력 내용'), {
      target: {
        value: [
          '나레이션: 모두 눈을 감아주세요.',
          '이미지: 현장 사진',
          'BGM: 심문 테마 반복',
          'GM: 조명을 낮춘다',
        ].join('\n'),
      },
    });
    fireEvent.click(screen.getByLabelText('현재 블록을 대본 입력 결과로 교체합니다.'));
    fireEvent.click(screen.getByRole('button', { name: '블록으로 적용' }));
    fireEvent.click(screen.getByRole('button', { name: /저장/ }));

    await waitFor(() => expect(mutateAsyncUpdate).toHaveBeenCalledTimes(1));
    expect(mutateAsyncUpdate.mock.calls[0][0].patch.lines).toMatchObject([
      { Index: 0, Type: 'dialogue', Speaker: '나레이션' },
      { Index: 1, Type: 'image', MediaID: 'image-1' },
      { Index: 2, Type: 'bgm', MediaID: 'bgm-1', BGMMode: 'loop' },
      { Index: 3, Type: 'gmNote', Text: '조명을 낮춘다' },
    ]);
  });

  it('clears script import draft when the modal is cancelled', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: '대본 입력' }));
    fireEvent.change(screen.getByLabelText('대본 입력 내용'), {
      target: { value: '나레이션: 이전 입력' },
    });
    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    fireEvent.click(screen.getByRole('button', { name: '대본 입력' }));
    expect((screen.getByLabelText('대본 입력 내용') as HTMLTextAreaElement).value).toBe('');
    expect(
      (screen.getByLabelText('현재 블록을 대본 입력 결과로 교체합니다.') as HTMLInputElement)
        .checked
    ).toBe(false);
  });

  it('does not save voice auto advance for blocks without voice media', async () => {
    renderEditor({
      section: {
        ...sampleSection,
        lines: [
          {
            Index: 0,
            Type: 'image',
            MediaID: 'image-1',
            AdvanceBy: 'voice',
          },
          {
            Index: 1,
            Type: 'dialogue',
            Text: '음성 없음',
            Speaker: 'Alice',
            VoiceMediaID: '',
            AdvanceBy: 'voice',
          },
        ],
      },
    });
    fireEvent.change(screen.getByLabelText('섹션 이름'), { target: { value: '정규화' } });
    fireEvent.click(screen.getByRole('button', { name: /저장/ }));

    await waitFor(() => expect(mutateAsyncUpdate).toHaveBeenCalledTimes(1));
    expect(mutateAsyncUpdate.mock.calls[0][0].patch.lines).toMatchObject([
      { Index: 0, Type: 'image', AdvanceBy: 'gm' },
      { Index: 1, Type: 'dialogue', AdvanceBy: 'gm' },
    ]);
  });

  it('does not save role advance when no matching character exists', async () => {
    renderEditor({
      characters: [],
      section: {
        ...sampleSection,
        lines: [
          {
            Index: 0,
            Type: 'dialogue',
            Text: '진행 역할 없음',
            Speaker: 'Alice',
            AdvanceBy: 'role:c1',
          },
        ],
      },
    });
    fireEvent.change(screen.getByLabelText('섹션 이름'), { target: { value: '역할 없음' } });
    fireEvent.click(screen.getByRole('button', { name: /저장/ }));

    await waitFor(() => expect(mutateAsyncUpdate).toHaveBeenCalledTimes(1));
    expect(mutateAsyncUpdate.mock.calls[0][0].patch.lines[0].AdvanceBy).toBe('gm');
    expect(screen.queryByRole('option', { name: '역할 지정' })).toBeNull();
  });

  it('moves blocks and keeps saved indices sequential', async () => {
    renderEditor();
    fireEvent.click(screen.getAllByLabelText('블록 아래로 이동')[0]);
    fireEvent.click(screen.getByRole('button', { name: /저장/ }));

    await waitFor(() => expect(mutateAsyncUpdate).toHaveBeenCalledTimes(1));
    expect(mutateAsyncUpdate.mock.calls[0][0].patch.lines).toMatchObject([
      { Index: 0, Text: '누구냐?' },
      { Index: 1, Text: '어두운 방 안.' },
    ]);
  });

  it('opens a test player preview and advances after voice playback finishes', async () => {
    vi.useFakeTimers();
    useMediaListMock.mockImplementation((_themeId: string, type?: string) => {
      if (type === 'VOICE') {
        return {
          data: [
            {
              id: 'voice-1',
              theme_id: 'theme-1',
              name: '나레이션 음성',
              type: 'VOICE',
              source_type: 'FILE',
              url: 'https://example.com/voice.mp3',
              tags: [],
              sort_order: 1,
              created_at: '2026-04-05T00:00:00Z',
            },
          ],
          isLoading: false,
        };
      }
      if (type === 'IMAGE') {
        return {
          data: [
            {
              id: 'image-1',
              theme_id: 'theme-1',
              name: '저택 전경',
              type: 'IMAGE',
              source_type: 'FILE',
              url: 'https://example.com/image.png',
              tags: [],
              sort_order: 2,
              created_at: '2026-04-05T00:00:00Z',
            },
          ],
          isLoading: false,
        };
      }
      return { data: [], isLoading: false };
    });

    renderEditor({
      section: {
        ...sampleSection,
        lines: [
          {
            Index: 0,
            Type: 'dialogue',
            Text: '모두 눈을 감아주세요.',
            Speaker: '나레이션',
            VoiceMediaID: 'voice-1',
            AdvanceBy: 'voice',
          },
          {
            Index: 1,
            Type: 'image',
            MediaID: 'image-1',
            Position: 'center',
            Size: 'medium',
            AdvanceBy: 'gm',
          },
        ],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: '테스트' }));

    const dialog = screen.getByRole('dialog', { name: '오프닝 테스트' });
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText('모두 눈을 감아주세요.')).toBeTruthy();
    expect(within(dialog).getByRole<HTMLButtonElement>('button', { name: '종료 대기' }).disabled)
      .toBe(true);

    act(() => {
      vi.advanceTimersByTime(2600);
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '음성 종료 후 계속' }));

    expect(within(dialog).getByText('저택 전경 · center')).toBeTruthy();
  });

  it('auto-advances BGM cue in the test player preview', () => {
    vi.useFakeTimers();
    useMediaListMock.mockImplementation((_themeId: string, type?: string) => {
      if (type === 'BGM') {
        return {
          data: [
            {
              id: 'bgm-1',
              theme_id: 'theme-1',
              name: '오프닝 테마',
              type: 'BGM',
              source_type: 'FILE',
              tags: [],
              sort_order: 1,
              created_at: '2026-04-05T00:00:00Z',
            },
          ],
          isLoading: false,
        };
      }
      return { data: [], isLoading: false };
    });

    renderEditor({
      section: {
        ...sampleSection,
        lines: [
          { Index: 0, Type: 'bgm', MediaID: 'bgm-1', BGMMode: 'loop' },
          {
            Index: 1,
            Type: 'gmNote',
            Text: '조명을 낮춘다.',
          },
        ],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: '테스트' }));

    expect(screen.getByText('오프닝 테마 · 반복 재생')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(screen.getByText('조명을 낮춘다.')).toBeTruthy();
  });

  it('save button is disabled when not dirty', () => {
    renderEditor();
    const saveBtn = screen.getByRole('button', { name: /저장/ }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('delete section calls useDeleteReadingSection after confirm', async () => {
    const onDeleted = vi.fn();
    renderEditor({ onDeleted });
    fireEvent.click(screen.getByRole('button', { name: /섹션 삭제/ }));
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));

    await waitFor(() => expect(mutateAsyncDelete).toHaveBeenCalledWith('sec-1'));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });

  it('409 conflict error shows reload, preserve, and cancel recovery actions', async () => {
    mutateAsyncUpdate.mockRejectedValueOnce(new Error('HTTP 409 Conflict'));
    renderEditor();
    const input = screen.getByLabelText('섹션 이름') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /저장/ }));

    await waitFor(() =>
      expect(screen.getByRole('alert', { name: '읽기 대사 저장 충돌' })).toBeTruthy()
    );
    expect(screen.getByText(/다른 탭이나 사용자가 더 최신 내용을 저장했습니다/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '내 변경 복사' }));
    expect(writeTextMock).toHaveBeenCalledWith(
      JSON.stringify(
        {
          name: 'x',
          bgmMediaId: sampleSection.bgmMediaId,
          lines: sampleSection.lines,
          sortOrder: sampleSection.sortOrder,
        },
        null,
        2
      )
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('내 변경 내용을 클립보드에 복사했습니다')
    );

    fireEvent.click(screen.getByRole('button', { name: '최신 상태 다시 불러오기' }));
    expect(invalidateQueriesMock).toHaveBeenCalled();
    expect(screen.queryByRole('alert', { name: '읽기 대사 저장 충돌' })).toBeNull();

    mutateAsyncUpdate.mockRejectedValueOnce(new Error('HTTP 409 Conflict'));
    fireEvent.click(screen.getByRole('button', { name: /저장/ }));
    await waitFor(() =>
      expect(screen.getByRole('alert', { name: '읽기 대사 저장 충돌' })).toBeTruthy()
    );
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.queryByRole('alert', { name: '읽기 대사 저장 충돌' })).toBeNull();
  });

  it('copy draft reports clipboard failure', async () => {
    writeTextMock.mockRejectedValueOnce(new Error('denied'));
    mutateAsyncUpdate.mockRejectedValueOnce(new Error('HTTP 409 Conflict'));

    renderEditor();
    const input = screen.getByLabelText('섹션 이름') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /저장/ }));

    await waitFor(() =>
      expect(screen.getByRole('alert', { name: '읽기 대사 저장 충돌' })).toBeTruthy()
    );
    fireEvent.click(screen.getByRole('button', { name: '내 변경 복사' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('클립보드에 복사할 수 없습니다'));
    expect(toast.success).not.toHaveBeenCalledWith('내 변경 내용을 클립보드에 복사했습니다');
  });
});
