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
  uploadMediaFileMock,
  useMediaDownloadUrlMock,
} = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  useEditorCharactersMock: vi.fn(),
  useEditorCluesMock: vi.fn(),
  useUpdateConfigJsonMock: vi.fn(),
  useCharacterRoleSheetMock: vi.fn(),
  useUpsertCharacterRoleSheetMock: vi.fn(),
  upsertRoleSheetMutateMock: vi.fn(),
  updateCharacterMutateMock: vi.fn(),
  uploadMediaFileMock: vi.fn(),
  useMediaDownloadUrlMock: vi.fn(),
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
  useUpdateCharacter: () => ({ mutate: updateCharacterMutateMock, isPending: false }),
}));

vi.mock('@/features/editor/mediaApi', () => ({
  uploadMediaFile: uploadMediaFileMock,
  useRequestUploadUrl: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useConfirmUpload: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMediaDownloadUrl: (mediaId?: string) => useMediaDownloadUrlMock(mediaId),
}));

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

import { CharacterAssignPanel } from '../../design/CharacterAssignPanel';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockCharacters = [
  { id: 'char-1', name: '홍길동', description: null, image_url: null, is_culprit: true, mystery_role: 'culprit' as const, sort_order: 0 },
  { id: 'char-2', name: '김철수', description: null, image_url: null, is_culprit: false, mystery_role: 'suspect' as const, sort_order: 1 },
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

function clickFirstClue() {
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
  });

  it('캐릭터 목록을 렌더링한다', () => {
    renderPanel();
    expect(screen.getByText('홍길동')).toBeDefined();
    expect(screen.getByText('김철수')).toBeDefined();
  });

  it('범인 캐릭터에 "범인" 라벨이 표시된다', () => {
    renderPanel();
    expect(screen.getByText('범인')).toBeDefined();
  });

  it('캐릭터 역할을 공범으로 변경한다', () => {
    renderPanel();
    fireEvent.click(screen.getByText('홍길동'));
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
      },
    });
  });

  it('캐릭터 선택 시 좌측 전체 단서와 우측 배정 영역이 표시된다', () => {
    renderPanel();
    fireEvent.click(screen.getByText('홍길동'));
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
    fireEvent.click(screen.getByText('홍길동'));

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
    fireEvent.click(screen.getByText('홍길동'));

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
    fireEvent.click(screen.getByText('홍길동'));
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(screen.getByText('역할지를 불러오지 못했습니다.')).toBeDefined();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('역할지 본문이 바뀌지 않았으면 저장 요청을 보내지 않는다', () => {
    useCharacterRoleSheetMock.mockReturnValue({ data: { format: 'markdown', markdown: { body: '기존 역할지' } }, isLoading: false });

    renderPanel();
    fireEvent.click(screen.getByText('홍길동'));
    fireEvent.click(screen.getByRole('button', { name: '역할지 저장' }));

    expect(upsertRoleSheetMutateMock).not.toHaveBeenCalled();
    expect(screen.getByText('저장되었습니다.')).toBeDefined();
  });

  it('역할지 저장 버튼 클릭 시 blur 자동 저장과 중복 호출하지 않는다', async () => {
    renderPanel();
    fireEvent.click(screen.getByText('홍길동'));

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
    fireEvent.click(screen.getByText('홍길동'));

    expect(screen.getByText('PDF 역할지')).toBeDefined();
    expect(screen.getByText('1페이지')).toBeDefined();
    expect(screen.getByTitle('홍길동 PDF 역할지 1페이지').getAttribute('src')).toBe(
      'https://cdn.example/role.pdf#page=1&toolbar=0&navpanes=0&view=FitH',
    );
    expect(screen.queryByRole('textbox', { name: '역할지 Markdown' })).toBeNull();
  });

  it('지원하지 않는 이미지 역할지 형식이면 안내를 표시한다', () => {
    useCharacterRoleSheetMock.mockReturnValue({
      data: { format: 'images', markdown: undefined },
      isLoading: false,
    });

    renderPanel();
    fireEvent.click(screen.getByText('홍길동'));

    expect(screen.getByText('아직 지원하지 않는 역할지 형식입니다.')).toBeDefined();
    expect(screen.queryByRole('textbox', { name: '역할지 Markdown' })).toBeNull();
  });

  it('좌측 단서 목록을 장소/태그로 검색할 수 있다', () => {
    renderPanel();
    fireEvent.click(screen.getByText('홍길동'));

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
    fireEvent.click(screen.getByText('홍길동'));
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
    fireEvent.click(screen.getByText('홍길동'));
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
    fireEvent.click(screen.getByText('홍길동'));
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
    fireEvent.click(screen.getByText('홍길동'));
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
    fireEvent.click(screen.getByText('홍길동'));
    fireEvent.click(screen.getByText('추가'));

    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [config] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    const cm = config.character_missions as Record<string, unknown[]>;
    expect(cm['char-1']).toHaveLength(1);
  });

  it('다른 캐릭터 선택 시 pending save가 flush된다', async () => {
    renderPanel();
    fireEvent.click(screen.getByText('홍길동'));
    clickFirstClue();
    expect(mutateMock).not.toHaveBeenCalled();

    // Switching characters should flush without waiting for the debounce.
    fireEvent.click(screen.getByText('김철수'));
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it('디바운스 창 안 여러 키 연속 편집 시 모든 변경이 병합되어 저장된다', async () => {
    renderPanel();
    fireEvent.click(screen.getByText('홍길동'));

    // 1) Add a clue at t=0 → starting_clue config enters pendingRef.
    clickFirstClue();

    // 2) Partial debounce elapses — no mutation yet.
    await act(async () => { vi.advanceTimersByTime(150); });
    expect(mutateMock).not.toHaveBeenCalled();

    // 3) Add a mission → character_missions must merge with existing pending
    //    starting_clue config rather than overwrite it.
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
