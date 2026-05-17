import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { forwardRef, useImperativeHandle, type ComponentType } from 'react';

const {
  useStoryInfosMock,
  useCreateStoryInfoMock,
  useUpdateStoryInfoMock,
  useDeleteStoryInfoMock,
  useFlowGraphMock,
  useUpdateFlowNodeMock,
  useEditorCharactersMock,
  useMediaListMock,
  useMediaDownloadUrlMock,
  mediaPickerPropsMock,
  toastLoadingMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  useStoryInfosMock: vi.fn(),
  useCreateStoryInfoMock: vi.fn(),
  useUpdateStoryInfoMock: vi.fn(),
  useDeleteStoryInfoMock: vi.fn(),
  useFlowGraphMock: vi.fn(),
  useUpdateFlowNodeMock: vi.fn(),
  useEditorCharactersMock: vi.fn(),
  useMediaListMock: vi.fn(),
  useMediaDownloadUrlMock: vi.fn(),
  mediaPickerPropsMock: vi.fn(),
  toastLoadingMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('@/features/editor/storyInfoApi', () => ({
  useStoryInfos: (...args: unknown[]) => useStoryInfosMock(...args),
  useCreateStoryInfo: (...args: unknown[]) => useCreateStoryInfoMock(...args),
  useUpdateStoryInfo: (...args: unknown[]) => useUpdateStoryInfoMock(...args),
  useDeleteStoryInfo: (...args: unknown[]) => useDeleteStoryInfoMock(...args),
}));

vi.mock('@/features/editor/mediaApi', () => ({
  useMediaList: (...args: unknown[]) => useMediaListMock(...args),
  useMediaDownloadUrl: (...args: unknown[]) => useMediaDownloadUrlMock(...args),
}));

vi.mock('@/features/editor/flowApi', () => ({
  useFlowGraph: (...args: unknown[]) => useFlowGraphMock(...args),
  useUpdateFlowNode: (...args: unknown[]) => useUpdateFlowNodeMock(...args),
}));

vi.mock('@/features/editor/api', () => ({
  useEditorCharacters: (...args: unknown[]) => useEditorCharactersMock(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    loading: toastLoadingMock,
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock('@mdxeditor/editor', () => ({
  MDXEditor: forwardRef<
    { insertMarkdown: (snippet: string) => void },
    {
      markdown: string;
      onChange: (markdown: string) => void;
      plugins?: Array<{
        markdownShortcuts?: boolean;
        jsxComponentDescriptors?: Array<{ name: string; Editor: ComponentType<{ mdastNode: { attributes: Array<{ name: string; value: string }> } }> }>;
      }>;
    }
  >(({ markdown, onChange, plugins = [] }, ref) => {
    useImperativeHandle(ref, () => ({
      insertMarkdown: (snippet: string) => onChange(`${markdown}${snippet}`),
    }));
    const hasMarkdownShortcuts = plugins.some((plugin) => plugin.markdownShortcuts);
    const mediaEmbedDescriptor = plugins
      .flatMap((plugin) => plugin.jsxComponentDescriptors ?? [])
      .find((descriptor) => descriptor.name === 'MediaEmbed');
    const mediaEmbeds = Array.from(markdown.matchAll(/<MediaEmbed\s+([^>]+)\/>/g));
    return (
      <div data-testid="mdx-editor-surface">
        <textarea
          aria-label="editable markdown"
          value={markdown}
          onChange={(event) => onChange(event.target.value)}
        />
        {hasMarkdownShortcuts && markdown.startsWith('> ') ? (
          <blockquote>{markdown.slice(2)}</blockquote>
        ) : null}
        {mediaEmbedDescriptor
          ? mediaEmbeds.map((match) => {
              const attrs = match[1] ?? '';
              const mdastNode = {
                attributes: Array.from(attrs.matchAll(/(\w+)=["']([^"']+)["']/g)).map((attr) => ({
                  name: attr[1],
                  value: attr[2],
                })),
              };
              const Editor = mediaEmbedDescriptor.Editor;
              return <Editor key={`${match.index}:${match[0]}`} mdastNode={mdastNode} />;
            })
          : null}
      </div>
    );
  }),
  jsxPlugin: vi.fn((params) => params),
  useLexicalNodeRemove: vi.fn(() => vi.fn()),
  useMdastNodeUpdater: vi.fn(() => vi.fn()),
  headingsPlugin: vi.fn(() => ({})),
  listsPlugin: vi.fn(() => ({})),
  quotePlugin: vi.fn(() => ({})),
  linkPlugin: vi.fn(() => ({})),
  markdownShortcutPlugin: vi.fn(() => ({ markdownShortcuts: true })),
  thematicBreakPlugin: vi.fn(() => ({})),
  toolbarPlugin: vi.fn(() => ({})),
  UndoRedo: () => null,
  BlockTypeSelect: () => null,
  BoldItalicUnderlineToggles: () => null,
  ListsToggle: () => null,
  CreateLink: () => null,
}));

vi.mock('../../media/MediaPicker', () => ({
  MediaPicker: (props: {
    open: boolean;
    filterType?: string;
    title?: string;
    onSelect: (media: { id: string; name: string; type: string }) => void;
  }) => {
    mediaPickerPropsMock(props);
    if (!props.open) return null;
    return (
      <div data-testid="media-picker">
        <span>{props.title}</span>
        <span>filter:{props.filterType}</span>
        <button
          type="button"
          onClick={() => props.onSelect({ id: 'image-2', name: '새 이미지', type: 'IMAGE' })}
        >
          새 이미지 선택
        </button>
        <button
          type="button"
          onClick={() => props.onSelect({ id: 'video-1', name: 'CCTV', type: 'VIDEO' })}
        >
          CCTV 선택
        </button>
        <button
          type="button"
          onClick={() => props.onSelect({ id: 'video-2', name: 'CCTV 후속', type: 'VIDEO' })}
        >
          CCTV 후속 선택
        </button>
      </div>
    );
  },
}));

import { InfoTab } from '../InfoTab';

const baseInfo = {
  id: 'info-1',
  themeId: 'theme-1',
  title: '피해자의 비밀',
  body: '처음 공개되는 정보',
  imageMediaId: 'image-1',
  relatedCharacterIds: ['char-1'],
  relatedClueIds: ['clue-1'],
  relatedLocationIds: ['loc-1'],
  sortOrder: 0,
  version: 3,
  createdAt: '2026-05-06T00:00:00Z',
  updatedAt: '2026-05-06T00:00:00Z',
};

function getInfoBodyEditor() {
  return within(screen.getByRole('region', { name: '정보 본문 작성기' })).getByRole('textbox', {
    name: 'editable markdown',
  });
}

function enterInfoEditMode() {
  fireEvent.click(screen.getByRole('button', { name: /정보 수정/ }));
}

let createMutate: ReturnType<typeof vi.fn>;
let updateMutate: ReturnType<typeof vi.fn>;
let deleteMutate: ReturnType<typeof vi.fn>;
let updateFlowNode: ReturnType<typeof vi.fn>;

beforeEach(() => {
  createMutate = vi.fn().mockResolvedValue({ ...baseInfo, id: 'info-2' });
  updateMutate = vi.fn().mockResolvedValue({ ...baseInfo, title: '수정된 정보' });
  deleteMutate = vi.fn().mockResolvedValue(undefined);
  updateFlowNode = vi.fn().mockResolvedValue({});

  useStoryInfosMock.mockReturnValue({
    data: [baseInfo],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  useCreateStoryInfoMock.mockReturnValue({
    mutateAsync: createMutate,
    isPending: false,
  });
  useUpdateStoryInfoMock.mockReturnValue({
    mutateAsync: updateMutate,
    isPending: false,
  });
  useDeleteStoryInfoMock.mockReturnValue({
    mutateAsync: deleteMutate,
    isPending: false,
  });
  useFlowGraphMock.mockReturnValue({
    data: {
      nodes: [
        {
          id: 'phase-1',
          theme_id: 'theme-1',
          type: 'phase',
          data: {
            label: '오프닝',
            onEnter: [
              {
                id: 'info-action',
                type: 'DELIVER_INFORMATION',
                params: {
                  deliveries: [
                    {
                      id: 'all',
                      target: { type: 'all_players' },
                      story_info_ids: ['info-1'],
                    },
                  ],
                },
              },
            ],
          },
          position_x: 0,
          position_y: 0,
          created_at: '2026-05-06T00:00:00Z',
          updated_at: '2026-05-06T00:00:00Z',
        },
        {
          id: 'phase-2',
          theme_id: 'theme-1',
          type: 'phase',
          data: {
            label: '심문',
            onEnter: [],
          },
          position_x: 160,
          position_y: 0,
          created_at: '2026-05-06T00:00:00Z',
          updated_at: '2026-05-06T00:00:00Z',
        },
      ],
      edges: [],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  useUpdateFlowNodeMock.mockReturnValue({
    mutateAsync: updateFlowNode,
    isPending: false,
  });
  useEditorCharactersMock.mockReturnValue({
    data: [
      { id: 'char-1', name: '고동' },
      { id: 'char-2', name: '송 사장' },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  useMediaListMock.mockReturnValue({
    data: [
      { id: 'image-1', name: '기존 이미지', type: 'IMAGE', source_type: 'FILE', url: 'http://localhost:8080/media/image-1.png' },
      { id: 'image-2', name: '새 이미지', type: 'IMAGE', source_type: 'FILE', url: 'http://localhost:8080/media/image-2.png' },
      { id: 'video-1', name: 'CCTV', type: 'VIDEO', source_type: 'FILE', url: 'http://localhost:8080/media/video-1.mp4' },
      { id: 'video-2', name: 'CCTV 후속', type: 'VIDEO', source_type: 'FILE', url: 'http://localhost:8080/media/video-2.mp4' },
    ],
  });
  useMediaDownloadUrlMock.mockReturnValue({ data: undefined, isLoading: false, isError: false });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('InfoTab', () => {
  it('shows saved story info as a read-only preview first', () => {
    render(<InfoTab themeId="theme-1" />);

    expect(screen.getByText('정보 관리')).toBeDefined();
    expect(screen.getAllByText('피해자의 비밀').length).toBeGreaterThanOrEqual(1);
    const selectedInfoButton = screen.getByRole('button', { name: /피해자의 비밀/ });
    expect(selectedInfoButton.textContent?.replace(/\s+/g, ' ').trim()).toBe('피해자의 비밀');
    expect(screen.getByRole('heading', { name: '피해자의 비밀' })).toBeDefined();
    expect(screen.getByRole('region', { name: '정보 본문 보기' })).toHaveProperty(
      'textContent',
      expect.stringContaining('처음 공개되는 정보'),
    );
    expect(screen.queryByLabelText('정보 제목')).toBeNull();
    expect(screen.queryByRole('region', { name: '정보 본문 작성기' })).toBeNull();
    expect(screen.getByRole('button', { name: /정보 수정/ })).toBeDefined();
    expect(screen.queryByText('이미지')).toBeNull();
    expect(screen.queryByText('이미지 선택')).toBeNull();
    expect(screen.queryByText('관련 등장인물')).toBeNull();
    expect(screen.queryByText('관련 단서')).toBeNull();
    expect(screen.queryByText('관련 장소')).toBeNull();
    expect(screen.queryByRole('region', { name: '정보 카드 프리뷰' })).toBeNull();
    expect(screen.getByRole('region', { name: '정보 배포 설정' })).toHaveProperty(
      'textContent',
      expect.stringContaining('오프닝'),
    );
    expect(screen.getByText('현재 전체 캐릭터에게 공개됩니다.')).toBeDefined();
  });

  it('shows typed markdown shortcuts as formatted content in the information editor', () => {
    render(<InfoTab themeId="theme-1" />);

    enterInfoEditMode();
    fireEvent.change(getInfoBodyEditor(), { target: { value: '> 현장 기록' } });

    const editor = screen.getByTestId('mdx-editor-surface');
    expect(editor.querySelector('blockquote')).toHaveProperty('textContent', '현장 기록');
  });

  it('renders image media embeds in the read-only preview without a card caption', () => {
    useStoryInfosMock.mockReturnValue({
      data: [
        {
          ...baseInfo,
          body: '<MediaEmbed mediaId="image-1" type="image" align="left" width="medium" />',
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useMediaListMock.mockReturnValue({
      data: [
        {
          id: 'image-1',
          theme_id: 'theme-1',
          name: '증거 사진',
          type: 'IMAGE',
          source_type: 'FILE',
          url: 'http://localhost:8080/media/evidence.png',
          tags: [],
          sort_order: 0,
          created_at: '2026-05-06T00:00:00Z',
        },
      ],
    });

    render(<InfoTab themeId="theme-1" />);

    const preview = screen.getByRole('region', { name: '정보 본문 보기' });
    expect(within(preview).getByRole('img', { name: '증거 사진' })).toHaveProperty(
      'src',
      'http://localhost:8080/media/evidence.png',
    );
    expect(within(preview).getByTestId('media-embed-display').querySelector('figcaption')).toBeNull();
    expect(within(preview).queryByText('증거 사진')).toBeNull();
    expect(within(preview).queryByText('이미지 블록')).toBeNull();
  });

  it('enters edit mode when the creator chooses to edit saved story info', () => {
    render(<InfoTab themeId="theme-1" />);

    enterInfoEditMode();

    expect(screen.getByLabelText('정보 제목')).toHaveProperty('value', '피해자의 비밀');
    expect(getInfoBodyEditor()).toHaveProperty('value', '처음 공개되는 정보');
  });

  it('opens legacy escaped markdown in edit mode as editable markdown', () => {
    useStoryInfosMock.mockReturnValue({
      data: [
        {
          ...baseInfo,
          body: '\\> \\*2008년 7월 28일 저녁\\*',
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<InfoTab themeId="theme-1" />);

    enterInfoEditMode();

    expect(getInfoBodyEditor()).toHaveProperty('value', '> *2008년 7월 28일 저녁*');
  });

  it('opens the editor first when the selected story info has no body', () => {
    useStoryInfosMock.mockReturnValue({
      data: [{ ...baseInfo, body: '' }],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<InfoTab themeId="theme-1" />);

    expect(screen.getByLabelText('정보 제목')).toHaveProperty('value', '피해자의 비밀');
    expect(getInfoBodyEditor()).toHaveProperty('value', '');
    expect(screen.queryByRole('button', { name: /정보 수정/ })).toBeNull();
  });

  it('creates a new story info card with empty refs', async () => {
    render(<InfoTab themeId="theme-1" />);

    fireEvent.click(screen.getByRole('button', { name: /정보 추가/ }));

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect(createMutate).toHaveBeenCalledWith({
      title: '새 스토리 정보',
      body: '',
      imageMediaId: null,
      relatedCharacterIds: [],
      relatedClueIds: [],
      relatedLocationIds: [],
      sortOrder: 1,
    });
  });

  it('shows a user-visible message when story info creation fails', async () => {
    createMutate.mockRejectedValueOnce(new Error('서버 오류'));
    render(<InfoTab themeId="theme-1" />);

    fireEvent.click(screen.getByRole('button', { name: /정보 추가/ }));

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', '서버 오류');
  });

  it('saves title/body without exposing image or reference fields', async () => {
    render(<InfoTab themeId="theme-1" />);

    enterInfoEditMode();
    fireEvent.change(screen.getByLabelText('정보 제목'), {
      target: { value: '수정된 정보' },
    });
    fireEvent.click(screen.getByRole('button', { name: /저장/ }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate).toHaveBeenCalledWith({
      id: 'info-1',
      patch: {
        title: '수정된 정보',
        body: '처음 공개되는 정보',
        imageMediaId: 'image-1',
        relatedCharacterIds: ['char-1'],
        relatedClueIds: ['clue-1'],
        relatedLocationIds: ['loc-1'],
        sortOrder: 0,
        version: 3,
      },
    });
  });

  it('자동저장으로 선택한 장면의 정보 배포 대상을 바꾼다', async () => {
    vi.useFakeTimers();
    render(<InfoTab themeId="theme-1" />);

    const deliverySettings = screen.getByRole('region', { name: '정보 배포 설정' });
    fireEvent.change(within(deliverySettings).getByLabelText('배포 장면'), {
      target: { value: 'phase-2' },
    });
    fireEvent.click(within(deliverySettings).getByRole('button', { name: /고동/ }));

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(updateFlowNode).toHaveBeenCalledTimes(1);
    expect(updateFlowNode).toHaveBeenCalledWith({
      nodeId: 'phase-2',
      body: {
        data: {
          label: '심문',
          onEnter: [
            expect.objectContaining({
              type: 'DELIVER_INFORMATION',
              params: {
                deliveries: [
                  expect.objectContaining({
                    target: { type: 'character', character_id: 'char-1' },
                    story_info_ids: ['info-1'],
                  }),
                ],
              },
            }),
          ],
        },
      },
    });
    expect(toastLoadingMock).toHaveBeenCalledWith('정보 배포 설정 저장 중...', expect.objectContaining({ id: 'info-delivery-autosave' }));
    expect(toastSuccessMock).toHaveBeenCalledWith('정보 배포 설정이 자동저장되었습니다', expect.objectContaining({ id: 'info-delivery-autosave' }));
    expect(within(deliverySettings).queryByRole('button', { name: /배포 적용/ })).toBeNull();
  });

  it('정보 배포 자동저장 실패 토스트에서 같은 변경을 재시도할 수 있다', async () => {
    vi.useFakeTimers();
    updateFlowNode
      .mockRejectedValueOnce(new Error('failed to update delivery'))
      .mockResolvedValueOnce({});
    render(<InfoTab themeId="theme-1" />);

    const deliverySettings = screen.getByRole('region', { name: '정보 배포 설정' });
    fireEvent.change(within(deliverySettings).getByLabelText('배포 장면'), {
      target: { value: 'phase-2' },
    });
    fireEvent.click(within(deliverySettings).getByRole('button', { name: /송 사장/ }));

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(toastErrorMock).toHaveBeenCalledWith(
      '정보 배포 설정 저장에 실패했습니다',
      expect.objectContaining({
        id: 'info-delivery-autosave',
        action: expect.objectContaining({ label: '재시도' }),
      }),
    );
    const [, errorOptions] = toastErrorMock.mock.calls[0];
    errorOptions.action.onClick();
    await act(async () => {
      await Promise.resolve();
    });

    expect(updateFlowNode).toHaveBeenCalledTimes(2);
    expect(updateFlowNode.mock.calls[1][0]).toEqual(expect.objectContaining({ nodeId: 'phase-2' }));
  });

  it('auto-dismisses save errors and lets creators close them immediately', async () => {
    vi.useFakeTimers();
    updateMutate.mockRejectedValueOnce(new Error('failed to update story info'));
    render(<InfoTab themeId="theme-1" />);

    enterInfoEditMode();
    fireEvent.change(screen.getByLabelText('정보 제목'), {
      target: { value: '저장 실패 확인' },
    });
    fireEvent.click(screen.getByRole('button', { name: /저장/ }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('failed to update story info'),
    );

    act(() => {
      vi.advanceTimersByTime(5999);
    });
    expect(screen.getByRole('alert')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole('alert')).toBeNull();

    updateMutate.mockRejectedValueOnce(new Error('failed to update story info'));
    fireEvent.click(screen.getByRole('button', { name: /저장/ }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('alert')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '오류 메시지 닫기' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('clears a save error when the creator edits the story info again', async () => {
    updateMutate.mockRejectedValueOnce(new Error('failed to update story info'));
    render(<InfoTab themeId="theme-1" />);

    enterInfoEditMode();
    fireEvent.change(screen.getByLabelText('정보 제목'), {
      target: { value: '저장 실패 확인' },
    });
    fireEvent.click(screen.getByRole('button', { name: /저장/ }));

    expect(await screen.findByRole('alert')).toBeDefined();

    fireEvent.change(screen.getByLabelText('정보 제목'), {
      target: { value: '다시 수정' },
    });

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('inserts media embeds into the MDX body and renders referenced media inside the editor', async () => {
    render(<InfoTab themeId="theme-1" />);

    enterInfoEditMode();
    fireEvent.click(screen.getByRole('button', { name: '영상 삽입' }));
    expect(screen.getByText('filter:VIDEO')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'CCTV 선택' }));

    expect(getInfoBodyEditor()).toHaveProperty(
      'value',
      expect.stringContaining('<MediaEmbed mediaId="video-1" type="video" align="center" width="medium" />')
    );
    const editorSurface = screen.getByTestId('mdx-editor-surface');
    const embedEditor = within(editorSurface).getByTestId('media-embed-editor');
    expect(embedEditor.querySelector('figcaption')).toBeNull();
    expect(within(editorSurface).queryByText('영상 블록')).toBeNull();
    expect(within(editorSurface).getByLabelText('CCTV 영상')).toBeDefined();

    fireEvent.click(within(editorSurface).getByRole('button', { name: 'CCTV 교체' }));
    expect(screen.getByText('filter:VIDEO')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'CCTV 후속 선택' }));
    expect(getInfoBodyEditor()).toHaveProperty(
      'value',
      expect.stringContaining('<MediaEmbed mediaId="video-2" type="video" align="center" width="medium" />')
    );
    expect(within(editorSurface).getByLabelText('CCTV 후속 영상')).toBeDefined();
    expect(within(editorSurface).getByRole('button', { name: 'CCTV 후속 교체' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /저장/ }));
    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate).toHaveBeenCalledWith({
      id: 'info-1',
      patch: expect.objectContaining({
        body: expect.stringContaining('<MediaEmbed mediaId="video-2" type="video" align="center" width="medium" />'),
      }),
    });
  });

  it('replaces media embeds from normalized legacy markdown content', async () => {
    useStoryInfosMock.mockReturnValue({
      data: [
        {
          ...baseInfo,
          body: [
            '\\> \\*2008년 7월 28일 저녁\\*',
            '<MediaEmbed mediaId="video-1" type="video" align="center" width="medium" />',
          ].join('\n'),
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<InfoTab themeId="theme-1" />);

    enterInfoEditMode();
    const editorSurface = screen.getByTestId('mdx-editor-surface');
    fireEvent.click(within(editorSurface).getByRole('button', { name: 'CCTV 교체' }));
    fireEvent.click(screen.getByRole('button', { name: 'CCTV 후속 선택' }));

    expect(getInfoBodyEditor()).toHaveProperty(
      'value',
      [
        '> *2008년 7월 28일 저녁*',
        '<MediaEmbed mediaId="video-2" type="video" align="center" width="medium" />',
      ].join('\n')
    );
  });

  it('does not mark legacy image or reference metadata as editable changes', async () => {
    render(<InfoTab themeId="theme-1" />);

    enterInfoEditMode();
    expect(screen.getByRole('button', { name: /저장/ })).toHaveProperty('disabled', true);
    expect(mediaPickerPropsMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ filterType: 'IMAGE', selectedId: 'image-1' })
    );
  });

  it('uses the saved version for a second save without stale dirty metadata', async () => {
    updateMutate
      .mockResolvedValueOnce({
        ...baseInfo,
        title: '1차 수정',
        version: 4,
        updatedAt: '2026-05-06T00:01:00Z',
      })
      .mockResolvedValueOnce({
        ...baseInfo,
        title: '2차 수정',
        version: 5,
        updatedAt: '2026-05-06T00:02:00Z',
      });
    render(<InfoTab themeId="theme-1" />);

    enterInfoEditMode();
    fireEvent.change(screen.getByLabelText('정보 제목'), {
      target: { value: '1차 수정' },
    });
    fireEvent.click(screen.getByRole('button', { name: /저장/ }));
    await waitFor(() =>
      expect(updateMutate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          patch: expect.objectContaining({ title: '1차 수정', version: 3 }),
        })
      )
    );

    await waitFor(() => expect(screen.getByRole('heading', { name: '1차 수정' })).toBeDefined());
    enterInfoEditMode();
    fireEvent.change(screen.getByLabelText('정보 제목'), {
      target: { value: '2차 수정' },
    });
    fireEvent.click(screen.getByRole('button', { name: /저장/ }));

    await waitFor(() =>
      expect(updateMutate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          patch: expect.objectContaining({ title: '2차 수정', version: 4 }),
        })
      )
    );
  });
});
