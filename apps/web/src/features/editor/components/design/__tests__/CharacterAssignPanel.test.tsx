import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiHttpError } from '@/lib/api-error';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mutateMock,
  useEditorCharactersMock,
  useEditorCluesMock,
  useUpdateConfigJsonMock,
  useCharacterRoleSheetMock,
  useUpsertCharacterRoleSheetMock,
  upsertRoleSheetMutateMock,
  updateCharacterMutateMock,
  updateCharacterPendingMock,
  uploadMediaFileMock,
  useMediaDownloadUrlMock,
  useMediaListMock,
} = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  useEditorCharactersMock: vi.fn(),
  useEditorCluesMock: vi.fn(),
  useUpdateConfigJsonMock: vi.fn(),
  useCharacterRoleSheetMock: vi.fn(),
  useUpsertCharacterRoleSheetMock: vi.fn(),
  upsertRoleSheetMutateMock: vi.fn(),
  updateCharacterMutateMock: vi.fn(),
  updateCharacterPendingMock: { value: false },
  uploadMediaFileMock: vi.fn(),
  useMediaDownloadUrlMock: vi.fn(),
  useMediaListMock: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/features/editor/api', () => ({
  editorKeys: {
    all: ['editor'],
    theme: (id: string) => ['editor', 'themes', id] as const,
  },
  useEditorCharacters: () => useEditorCharactersMock(),
  useEditorClues: () => useEditorCluesMock(),
  useUpdateConfigJson: () => useUpdateConfigJsonMock(),
  useCharacterRoleSheet: (characterId: string) => useCharacterRoleSheetMock(characterId),
  useUpsertCharacterRoleSheet: (characterId: string) => useUpsertCharacterRoleSheetMock(characterId),
  useUpdateCharacter: () => ({ mutate: updateCharacterMutateMock, isPending: updateCharacterPendingMock.value }),
}));

vi.mock('@/features/editor/mediaApi', () => ({
  uploadMediaFile: uploadMediaFileMock,
  useRequestUploadUrl: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useConfirmUpload: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMediaDownloadUrl: (mediaId?: string) => useMediaDownloadUrlMock(mediaId),
  useMediaList: () => useMediaListMock(),
}));

vi.mock('@/features/editor/components/media/MediaPicker', () => ({
  MediaPicker: ({
    open,
    filterType,
    useCase,
    selectedId,
    onSelect,
  }: {
    open: boolean;
    filterType?: string;
    useCase?: string;
    selectedId?: string | null;
    onSelect: (media: { id: string; name: string; type: string }) => void;
  }) => {
    if (!open) return null;
    if (useCase === 'role_sheet_document') {
      return (
        <div>
          <span>useCase:{useCase}</span>
          <span>selected:{selectedId ?? 'none'}</span>
          <button
            type="button"
            onClick={() => onSelect({ id: 'document-1', name: 'PDF 역할지', type: 'DOCUMENT' })}
          >
            PDF 역할지 선택
          </button>
        </div>
      );
    }

    return (
      <div>
        <span>filter:{filterType}</span>
        <span>selected:{selectedId ?? 'none'}</span>
        <button
          type="button"
          onClick={() => onSelect({ id: 'image-1', name: '캐릭터 이미지', type: 'IMAGE' })}
        >
          캐릭터 이미지 선택
        </button>
      </div>
    );
  },
}));

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

import { CharacterAssignPanel } from '../../design/CharacterAssignPanel';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockCharacters = [
  {
    id: 'char-1',
    theme_id: 'theme-1',
    name: '홍길동',
    description: null,
    image_url: null,
    is_culprit: true,
    mystery_role: 'culprit' as const,
    sort_order: 0,
    is_playable: true,
    show_in_intro: true,
    can_speak_in_reading: true,
    is_voting_candidate: true,
  },
  {
    id: 'char-2',
    theme_id: 'theme-1',
    name: '김철수',
    description: null,
    image_url: null,
    is_culprit: false,
    mystery_role: 'suspect' as const,
    sort_order: 1,
    is_playable: false,
    show_in_intro: true,
    can_speak_in_reading: true,
    is_voting_candidate: false,
  },
];

const mockClues = [
  { id: 'clue-1', name: '피 묻은 칼', location: '서재', round: 1, tag: '물증' },
  { id: 'clue-2', name: '비밀 편지', location: '부엌', round: 1, tag: '문서' },
];

const baseTheme = {
  id: 'theme-1',
  title: '테스트',
  slug: 'test',
  description: '',
  cover_image: null,
  min_players: 4,
  max_players: 6,
  duration_min: 90,
  price: 0,
  status: 'DRAFT' as const,
  config_json: { modules: [] },
  version: 1,
  created_at: '2026-04-13T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPanel(themeArg: typeof baseTheme = baseTheme) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  // Seed cache so optimistic updates have a previous snapshot to roll back to.
  qc.setQueryData(['editor', 'themes', 'theme-1'], themeArg);
  const view = render(
    <QueryClientProvider client={qc}>
      <CharacterAssignPanel themeId="theme-1" theme={themeArg} />
    </QueryClientProvider>,
  );
  return { ...view, qc };
}

function readStartingClues(config: Record<string, unknown>) {
  const modules = config.modules as Record<string, { config?: { startingClues?: Record<string, string[]> } }>;
  return modules?.starting_clue?.config?.startingClues ?? {};
}

const endcardSectionName = /^결과 카드(?:작성됨|비어 있음)$/;
const roleSheetSectionName = /^역할지Markdown 또는 PDF$/;
const startingClueSectionName = /^시작 단서\d+\/\d+개 배정$/;
const hiddenMissionSectionName = /^히든 미션\d+개$/;

function openCharacterSection(name: RegExp) {
  const button = screen.getByRole('button', { name });
  if (button.getAttribute('aria-expanded') === 'false') {
    fireEvent.click(button);
  }
}

function openEndcardSection() {
  openCharacterSection(endcardSectionName);
}

function openRoleSheetSection() {
  openCharacterSection(roleSheetSectionName);
}

function openStartingClueSection() {
  openCharacterSection(startingClueSectionName);
}

function openHiddenMissionSection() {
  openCharacterSection(hiddenMissionSectionName);
}

function clickFirstClue() {
  openStartingClueSection();
  fireEvent.click(screen.getByRole('button', { name: /피 묻은 칼/ }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CharacterAssignPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useEditorCharactersMock.mockReturnValue({ data: mockCharacters, isLoading: false });
    useEditorCluesMock.mockReturnValue({ data: mockClues, isLoading: false });
    useUpdateConfigJsonMock.mockReturnValue({ mutate: mutateMock, isPending: false });
    useCharacterRoleSheetMock.mockReturnValue({ data: { format: 'markdown', markdown: { body: '' } }, isLoading: false });
    useUpsertCharacterRoleSheetMock.mockReturnValue({ mutate: upsertRoleSheetMutateMock, isPending: false });
    useMediaDownloadUrlMock.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() });
    useMediaListMock.mockReturnValue({
      data: [{ id: 'image-1', name: '캐릭터 이미지', type: 'IMAGE' }],
      isLoading: false,
    });
    updateCharacterPendingMock.value = false;
  });

  it('공통 엔티티 Shell로 캐릭터 목록과 상세를 렌더링한다', () => {
    renderPanel();
    expect(screen.getByRole('region', { name: '캐릭터 목록' })).toBeDefined();
    expect(screen.getByRole('button', { name: '홍길동 선택' })).toBeDefined();
    expect(screen.getByRole('button', { name: '김철수 선택' })).toBeDefined();
    expect(screen.queryByText(/시스템 ID/)).toBeNull();
  });

  it('기본 정보만 처음부터 열고 세부 제작 섹션은 접어 둔다', () => {
    renderPanel();

    expect(screen.getByRole('button', { name: /기본 정보/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: endcardSectionName }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: roleSheetSectionName }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: startingClueSectionName }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: hiddenMissionSectionName }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('textbox', { name: '역할지 Markdown' })).toBeNull();
  });

  it('범인 캐릭터에 "범인" 라벨이 표시된다', () => {
    renderPanel();
    expect(screen.getAllByText('범인').length).toBeGreaterThan(0);
  });

  it('캐릭터 역할을 공범으로 변경한다', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));
    fireEvent.click(screen.getByRole('button', { name: /공범/ }));

    expect(updateCharacterMutateMock).toHaveBeenCalledWith({
      characterId: 'char-1',
      body: {
        name: '홍길동',
        description: undefined,
        image_url: undefined,
        is_culprit: false,
        mystery_role: 'accomplice',
        sort_order: 0,
        is_playable: true,
        show_in_intro: true,
        can_speak_in_reading: true,
        is_voting_candidate: true,
        alias_rules: [],
      },
    });
  });

  it('등장인물 유형을 NPC로 변경하면 투표 후보를 함께 끈다', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));
    fireEvent.click(screen.getByLabelText(/플레이어 캐릭터/));

    expect(updateCharacterMutateMock).toHaveBeenCalledWith({
      characterId: 'char-1',
      body: {
        name: '홍길동',
        description: undefined,
        image_url: undefined,
        is_culprit: true,
        mystery_role: 'culprit',
        sort_order: 0,
        is_playable: false,
        show_in_intro: true,
        can_speak_in_reading: true,
        is_voting_candidate: false,
        alias_rules: [],
      },
    });
  });

  it('조건부 표시 규칙을 저장한다', () => {
    useEditorCharactersMock.mockReturnValue({
      data: [{
        ...mockCharacters[0],
        alias_rules: [{
          id: 'alias-1',
          label: '정체 공개',
          display_name: '밤의 목격자',
          display_icon_url: '',
          priority: 1,
          condition: {
            id: 'group-1',
            operator: 'AND',
            rules: [{
              id: 'rule-1',
              variable: 'character_alive',
              target_character_id: 'char-1',
              comparator: '=',
              value: 'true',
            }],
          },
        }],
      }],
      isLoading: false,
    });

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));
    fireEvent.change(screen.getByLabelText('표시 이름'), { target: { value: '비밀 목격자' } });
    fireEvent.click(screen.getByRole('button', { name: '플레이 중 표시 저장' }));

    expect(updateCharacterMutateMock).toHaveBeenCalledWith({
      characterId: 'char-1',
      body: expect.objectContaining({
        name: '홍길동',
        mystery_role: 'culprit',
        is_culprit: true,
        alias_rules: [expect.objectContaining({
          id: 'alias-1',
          label: '정체 공개',
          display_name: '비밀 목격자',
          priority: 1,
        })],
      }),
    });
  });

  it('등장인물 유형 저장 중에는 추가 토글을 막는다', () => {
    updateCharacterPendingMock.value = true;

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));

    const playableToggle = screen.getByLabelText(/플레이어 캐릭터/) as HTMLInputElement;
    expect(playableToggle.disabled).toBe(true);
    fireEvent.click(playableToggle);

    expect(updateCharacterMutateMock).not.toHaveBeenCalled();
  });

  it('결과 카드 내용을 캐릭터 저장 계약으로 보낸다', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));
    openEndcardSection();

    fireEvent.change(screen.getByRole('textbox', { name: '제목' }), {
      target: { value: '범인의 후일담' },
    });
    fireEvent.click(screen.getByRole('button', { name: '결과 카드 이미지 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '캐릭터 이미지 선택' }));
    fireEvent.change(screen.getByRole('textbox', { name: '본문' }), {
      target: { value: '사건 이후의 선택을 보여준다.' },
    });
    fireEvent.click(screen.getByRole('button', { name: '결과 카드 저장' }));

    expect(updateCharacterMutateMock).toHaveBeenCalledWith({
      characterId: 'char-1',
      body: {
        name: '홍길동',
        description: undefined,
        image_url: undefined,
        is_culprit: true,
        mystery_role: 'culprit',
        sort_order: 0,
        is_playable: true,
        show_in_intro: true,
        can_speak_in_reading: true,
        is_voting_candidate: true,
        endcard_title: '범인의 후일담',
        endcard_body: '사건 이후의 선택을 보여준다.',
        endcard_image_url: '',
        endcard_image_media_id: 'image-1',
      },
    });
  });

  it('기본 정보에서 캐릭터 이미지를 미디어 관리 IMAGE로 선택한다', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '이미지 선택' }));
    expect(screen.getByText('filter:IMAGE')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '캐릭터 이미지 선택' }));

    expect(updateCharacterMutateMock).toHaveBeenCalledWith({
      characterId: 'char-1',
      body: expect.objectContaining({
        name: '홍길동',
        image_url: '',
        image_media_id: 'image-1',
        mystery_role: 'culprit',
        is_culprit: true,
      }),
    });
  });

  it('기본 정보에서 캐릭터 이미지를 삭제한다', () => {
    useEditorCharactersMock.mockReturnValue({
      data: [{ ...mockCharacters[0], image_media_id: 'image-1' }],
      isLoading: false,
    });

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '제거' }));

    expect(updateCharacterMutateMock).toHaveBeenCalledWith({
      characterId: 'char-1',
      body: expect.objectContaining({
        name: '홍길동',
        image_media_id: null,
        mystery_role: 'culprit',
        is_culprit: true,
      }),
    });
  });


  it('선택한 캐릭터가 목록에서 사라지면 현재 상세 캐릭터 ID로 저장한다', async () => {
    let currentCharacters = mockCharacters;
    useEditorCharactersMock.mockImplementation(() => ({ data: currentCharacters, isLoading: false }));

    const { rerender, qc } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '김철수 선택' }));

    currentCharacters = [mockCharacters[0]];
    rerender(
      <QueryClientProvider client={qc}>
        <CharacterAssignPanel themeId="theme-1" theme={baseTheme} />
      </QueryClientProvider>,
    );

    expect(screen.queryByRole('button', { name: '김철수 선택' })).toBeNull();
    openStartingClueSection();
    expect(screen.getByText('홍길동의 시작 단서')).toBeDefined();

    clickFirstClue();
    await act(async () => { vi.advanceTimersByTime(1500); });

    const [payload] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    expect(readStartingClues(payload)['char-1']).toContain('clue-1');
    expect(readStartingClues(payload)['char-2']).toBeUndefined();
  });

  it('검색으로 상세 캐릭터가 바뀌면 보이는 캐릭터 ID로 시작 단서를 저장한다', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '김철수 선택' }));

    fireEvent.change(screen.getByRole('textbox', { name: '캐릭터 검색' }), {
      target: { value: '홍길동' },
    });

    openStartingClueSection();
    expect(screen.getByText('홍길동의 시작 단서')).toBeDefined();
    clickFirstClue();
    await act(async () => { vi.advanceTimersByTime(1500); });

    const [payload] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    expect(readStartingClues(payload)['char-1']).toContain('clue-1');
    expect(readStartingClues(payload)['char-2']).toBeUndefined();
  });

  it('캐릭터 선택 시 좌측 전체 단서와 우측 배정 영역이 표시된다', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));
    openStartingClueSection();
    expect(screen.getByText('전체 단서 목록')).toBeDefined();
    expect(screen.getByText('홍길동의 시작 단서')).toBeDefined();
    expect(screen.getByText('피 묻은 칼')).toBeDefined();
    expect(screen.getByText('비밀 편지')).toBeDefined();
  });


  it('역할지 저장 성공 상태를 사용자에게 표시한다', () => {
    upsertRoleSheetMutateMock.mockImplementation((_payload, options) => {
      options?.onSuccess?.();
    });

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));
    openRoleSheetSection();

    const roleSheet = screen.getByRole('textbox', { name: '역할지 Markdown' });
    fireEvent.change(roleSheet, { target: { value: '## 비밀\n범인은 아직 모른다.' } });
    fireEvent.click(screen.getByRole('button', { name: '역할지 저장' }));

    expect(screen.getByText('저장되었습니다.')).toBeDefined();
  });

  it('저장된 역할지가 없으면 빈 Markdown 초안으로 시작한다', () => {
    useCharacterRoleSheetMock.mockReturnValue({
      data: undefined,
      error: new ApiHttpError({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'role sheet not found',
      }),
      isError: true,
      isLoading: false,
      refetch: vi.fn(),
    });

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));
    openRoleSheetSection();

    expect(screen.getByText('아직 저장된 역할지가 없습니다.')).toBeDefined();
    expect((screen.getByRole('textbox', { name: '역할지 Markdown' }) as HTMLTextAreaElement).value).toBe('');
  });

  it('역할지 로드 실패 시 재시도 버튼을 표시한다', () => {
    const refetch = vi.fn();
    useCharacterRoleSheetMock.mockReturnValue({
      data: undefined,
      error: new ApiHttpError({
        type: 'about:blank',
        title: 'Server Error',
        status: 500,
        detail: 'server error',
      }),
      isError: true,
      isLoading: false,
      refetch,
    });

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));
    openRoleSheetSection();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(screen.getByText('역할지를 불러오지 못했습니다.')).toBeDefined();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('역할지 본문이 바뀌지 않았으면 저장 요청을 보내지 않는다', () => {
    useCharacterRoleSheetMock.mockReturnValue({ data: { format: 'markdown', markdown: { body: '기존 역할지' } }, isLoading: false });

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));
    openRoleSheetSection();
    fireEvent.click(screen.getByRole('button', { name: '역할지 저장' }));

    expect(upsertRoleSheetMutateMock).not.toHaveBeenCalled();
    expect(screen.getByText('저장되었습니다.')).toBeDefined();
  });

  it('역할지 저장 버튼 클릭 시 blur 자동 저장과 중복 호출하지 않는다', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));
    openRoleSheetSection();

    const roleSheet = screen.getByRole('textbox', { name: '역할지 Markdown' });
    const saveButton = screen.getByRole('button', { name: '역할지 저장' });
    fireEvent.change(roleSheet, { target: { value: '수정된 역할지' } });
    fireEvent.mouseDown(saveButton);
    fireEvent.blur(roleSheet);
    fireEvent.click(saveButton);

    expect(upsertRoleSheetMutateMock).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(upsertRoleSheetMutateMock).toHaveBeenCalledTimes(1);
  });


  it('PDF 역할지는 업로드 버튼과 페이지 viewer를 표시한다', () => {
    useCharacterRoleSheetMock.mockReturnValue({
      data: { format: 'pdf', pdf: { media_id: 'media-pdf-1' }, markdown: undefined },
      isLoading: false,
    });
    useMediaDownloadUrlMock.mockReturnValue({
      data: { url: 'https://cdn.example/role.pdf', expires_at: '2026-05-02T00:10:00Z' },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));
    openRoleSheetSection();

    expect(screen.getByText('PDF 역할지')).toBeDefined();
    expect(screen.getByText('1페이지')).toBeDefined();
    expect(screen.getByTitle('홍길동 PDF 역할지 1페이지').getAttribute('src')).toBe(
      'https://cdn.example/role.pdf#page=1&toolbar=0&navpanes=0&view=FitH',
    );
    expect(screen.queryByRole('textbox', { name: '역할지 Markdown' })).toBeNull();
  });

  it('PDF 역할지를 미디어 관리 문서 picker로 연결한다', () => {
    upsertRoleSheetMutateMock.mockImplementation((_payload, options) => {
      options?.onSuccess?.();
    });

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));
    openRoleSheetSection();
    fireEvent.click(screen.getByRole('button', { name: /PDF미디어 문서 선택/ }));
    fireEvent.click(screen.getByRole('button', { name: 'PDF 선택' }));

    expect(screen.getByText('useCase:role_sheet_document')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'PDF 역할지 선택' }));

    expect(upsertRoleSheetMutateMock).toHaveBeenCalledWith(
      { format: 'pdf', pdf: { media_id: 'document-1' } },
      expect.any(Object),
    );
  });

  it('이미지 롤지는 한 페이지씩 넘겨 볼 수 있다', () => {
    useCharacterRoleSheetMock.mockReturnValue({
      data: {
        format: 'images',
        images: {
          image_urls: [
            'https://cdn.example/role-1.webp',
            'https://cdn.example/role-2.webp',
          ],
        },
        markdown: undefined,
      },
      isLoading: false,
    });

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));
    openRoleSheetSection();

    expect(screen.getByText('이미지 롤지')).toBeDefined();
    expect(screen.getByText('1 / 2페이지')).toBeDefined();
    expect(screen.getByAltText('홍길동 이미지 롤지 1페이지').getAttribute('src')).toBe('https://cdn.example/role-1.webp');
    fireEvent.click(screen.getByRole('button', { name: '다음 이미지 페이지' }));
    expect(screen.getByText('2 / 2페이지')).toBeDefined();
    expect(screen.getByAltText('홍길동 이미지 롤지 2페이지').getAttribute('src')).toBe('https://cdn.example/role-2.webp');
    expect(screen.queryByRole('textbox', { name: '역할지 Markdown' })).toBeNull();
  });

  it('이미지 URL을 추가하고 이미지 롤지를 저장한다', () => {
    upsertRoleSheetMutateMock.mockImplementation((_payload, options) => {
      options?.onSuccess?.();
    });

    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));
    openRoleSheetSection();
    fireEvent.click(screen.getAllByRole('button', { name: /이미지/ }).at(-1)!);
    fireEvent.change(screen.getByRole('textbox', { name: '이미지 페이지 URL' }), {
      target: { value: 'https://cdn.example/role-1.webp' },
    });
    fireEvent.click(screen.getByRole('button', { name: '이미지 페이지 추가' }));
    fireEvent.click(screen.getByRole('button', { name: '이미지 롤지 저장' }));

    expect(upsertRoleSheetMutateMock).toHaveBeenCalledWith(
      {
        format: 'images',
        images: { image_urls: ['https://cdn.example/role-1.webp'] },
      },
      expect.any(Object),
    );
    expect(screen.getByText('저장되었습니다.')).toBeDefined();
  });

  it('좌측 단서 목록을 장소/태그로 검색할 수 있다', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));
    openStartingClueSection();

    fireEvent.change(screen.getByPlaceholderText('단서명, 장소, 태그 검색'), {
      target: { value: '부엌' },
    });

    expect(screen.queryByText('피 묻은 칼')).toBeNull();
    expect(screen.getByText('비밀 편지')).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText('단서명, 장소, 태그 검색'), {
      target: { value: '문서' },
    });

    expect(screen.queryByText('피 묻은 칼')).toBeNull();
    expect(screen.getByText('비밀 편지')).toBeDefined();
  });

  it('debounce 1500ms 후에 mutate가 호출된다', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));
    clickFirstClue();

    // Regression guard: 500ms (old window) must NOT fire.
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(mutateMock).not.toHaveBeenCalled();

    // Full 1500ms window → exactly one mutation.
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [config] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    expect(config).not.toHaveProperty('character_clues');
    expect(readStartingClues(config)['char-1']).toContain('clue-1');
  });

  it('optimistic update: 단서 추가 즉시 query cache가 갱신된다', () => {
    const { qc } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));
    clickFirstClue();

    // Cache reflects the toggle synchronously — no debounce wait.
    const cached = qc.getQueryData<typeof baseTheme>(['editor', 'themes', 'theme-1']);
    expect(cached?.config_json).not.toHaveProperty('character_clues');
    expect(readStartingClues(cached?.config_json ?? {})['char-1']).toContain('clue-1');
    // Network call is still pending.
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('mutate 실패 시 optimistic update가 rollback된다', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));
    clickFirstClue();

    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [, opts] = mutateMock.mock.calls[0] as [
      unknown,
      { onError?: (e: Error) => void },
    ];
    expect(typeof opts?.onError).toBe('function');
    // Invoking onError should not throw — rollback path writes previous snapshot.
    expect(() => opts.onError?.(new Error('boom'))).not.toThrow();
  });

  it('rollback이 진짜 pre-edit snapshot으로 복원한다 (round-2 N-1 / CR)', async () => {
    // round-2: schedule-time mirror로 즉시 cache가 변경된 후, mutation 실패
    // 시 rollback이 그 mirror된 상태가 아니라 *진짜 pre-edit* snapshot으로
    // 되돌아가야 한다. pendingSnapshotRef가 첫 schedule 시점에 캡처한
    // baseTheme로 cache가 복원되는지 검증.
    const { qc } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));
    clickFirstClue();

    // schedule-time mirror 즉시 적용된 상태 확인.
    const mirrored = qc.getQueryData<typeof baseTheme>(['editor', 'themes', 'theme-1']);
    expect(mirrored?.config_json).not.toHaveProperty('character_clues');
    expect(readStartingClues(mirrored?.config_json ?? {})['char-1']).toContain('clue-1');

    await act(async () => { vi.advanceTimersByTime(1500); });
    const [, opts] = mutateMock.mock.calls[0] as [
      unknown,
      { onError?: (e: Error) => void },
    ];

    // Trigger the failure path.
    act(() => {
      opts.onError?.(new Error('boom'));
    });

    // Cache is restored to the original baseTheme snapshot.
    const restored = qc.getQueryData<typeof baseTheme>(['editor', 'themes', 'theme-1']);
    expect(readStartingClues(restored?.config_json ?? {})['char-1']).toBeUndefined();
  });

  it('미션 추가 버튼이 동작한다 (1500ms debounce)', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));
    openHiddenMissionSection();
    fireEvent.click(screen.getByText('추가'));

    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [config] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    const cm = config.character_missions as Record<string, unknown[]>;
    expect(cm['char-1']).toHaveLength(1);
  });

  it('다른 캐릭터 선택 시 pending save가 flush된다', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));
    clickFirstClue();
    expect(mutateMock).not.toHaveBeenCalled();

    // Switching characters should flush without waiting for the debounce.
    fireEvent.click(screen.getByRole('button', { name: '김철수 선택' }));
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it('디바운스 창 안 여러 키 연속 편집 시 모든 변경이 병합되어 저장된다', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 선택' }));

    // 1) Add a clue at t=0 → starting_clue config enters pendingRef.
    clickFirstClue();

    // 2) Partial debounce elapses — no mutation yet.
    await act(async () => { vi.advanceTimersByTime(150); });
    expect(mutateMock).not.toHaveBeenCalled();

    // 3) Add a mission → character_missions must merge with existing pending
    //    starting_clue config rather than overwrite it.
    openHiddenMissionSection();
    fireEvent.click(screen.getByText('추가'));

    // 4) Full debounce window from the latest edit → single mutation.
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(mutateMock).toHaveBeenCalledTimes(1);

    const [payload] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    const cm = payload.character_missions as Record<string, unknown[]> | undefined;
    expect(payload).not.toHaveProperty('character_clues');
    expect(readStartingClues(payload)['char-1']).toContain('clue-1');
    expect(cm?.['char-1']).toHaveLength(1);
  });

  it('캐릭터가 없으면 안내 메시지를 표시한다', () => {
    useEditorCharactersMock.mockReturnValue({ data: [], isLoading: false });
    renderPanel();
    expect(screen.getByText('캐릭터를 먼저 추가하세요')).toBeDefined();
  });
});
