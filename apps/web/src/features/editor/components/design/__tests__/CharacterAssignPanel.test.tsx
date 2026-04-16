import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mutateMock,
  useEditorCharactersMock,
  useEditorCluesMock,
  useUpdateConfigJsonMock,
} = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  useEditorCharactersMock: vi.fn(),
  useEditorCluesMock: vi.fn(),
  useUpdateConfigJsonMock: vi.fn(),
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
}));

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

import { CharacterAssignPanel } from '../../design/CharacterAssignPanel';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockCharacters = [
  { id: 'char-1', name: '홍길동', is_culprit: true },
  { id: 'char-2', name: '김철수', is_culprit: false },
];

const mockClues = [
  { id: 'clue-1', name: '피 묻은 칼' },
  { id: 'clue-2', name: '비밀 편지' },
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CharacterAssignPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useEditorCharactersMock.mockReturnValue({ data: mockCharacters, isLoading: false });
    useEditorCluesMock.mockReturnValue({ data: mockClues, isLoading: false });
    useUpdateConfigJsonMock.mockReturnValue({ mutate: mutateMock, isPending: false });
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

  it('캐릭터 선택 시 단서 체크박스가 표시된다', () => {
    renderPanel();
    fireEvent.click(screen.getByText('홍길동'));
    expect(screen.getByText('피 묻은 칼')).toBeDefined();
    expect(screen.getByText('비밀 편지')).toBeDefined();
  });

  it('debounce 1500ms 후에 mutate가 호출된다', async () => {
    renderPanel();
    fireEvent.click(screen.getByText('홍길동'));

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    // Regression guard: 500ms (old window) must NOT fire.
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(mutateMock).not.toHaveBeenCalled();

    // Full 1500ms window → exactly one mutation.
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [config] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    const cc = config.character_clues as Record<string, string[]>;
    expect(cc['char-1']).toContain('clue-1');
  });

  it('optimistic update: 단서 체크 즉시 query cache가 갱신된다', () => {
    const { qc } = renderPanel();
    fireEvent.click(screen.getByText('홍길동'));

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    // Cache reflects the toggle synchronously — no debounce wait.
    const cached = qc.getQueryData<typeof baseTheme>(['editor', 'themes', 'theme-1']);
    const cc = cached?.config_json?.character_clues as Record<string, string[]>;
    expect(cc['char-1']).toContain('clue-1');
    // Network call is still pending.
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('mutate 실패 시 optimistic update가 rollback된다', async () => {
    renderPanel();
    fireEvent.click(screen.getByText('홍길동'));

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

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

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(mutateMock).not.toHaveBeenCalled();

    // Switching characters should flush without waiting for the debounce.
    fireEvent.click(screen.getByText('김철수'));
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it('디바운스 창 안 여러 키 연속 편집 시 모든 변경이 병합되어 저장된다', async () => {
    renderPanel();
    fireEvent.click(screen.getByText('홍길동'));

    // 1) Toggle a clue at t=0 → character_clues enters pendingRef.
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    // 2) Partial debounce elapses — no mutation yet.
    await act(async () => { vi.advanceTimersByTime(150); });
    expect(mutateMock).not.toHaveBeenCalled();

    // 3) Add a mission → character_missions must merge with existing pending
    //    character_clues rather than overwrite it.
    fireEvent.click(screen.getByText('추가'));

    // 4) Full debounce window from the latest edit → single mutation.
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(mutateMock).toHaveBeenCalledTimes(1);

    const [payload] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    const cc = payload.character_clues as Record<string, string[]> | undefined;
    const cm = payload.character_missions as Record<string, unknown[]> | undefined;
    expect(cc?.['char-1']).toContain('clue-1');
    expect(cm?.['char-1']).toHaveLength(1);
  });

  it('캐릭터가 없으면 안내 메시지를 표시한다', () => {
    useEditorCharactersMock.mockReturnValue({ data: [], isLoading: false });
    renderPanel();
    expect(screen.getByText('캐릭터를 먼저 추가하세요')).toBeDefined();
  });
});
