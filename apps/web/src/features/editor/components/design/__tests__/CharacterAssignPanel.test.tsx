import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mutateMock, useEditorCharactersMock, useEditorCluesMock, useUpdateConfigJsonMock } =
  vi.hoisted(() => ({
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
    render(<CharacterAssignPanel themeId="theme-1" theme={baseTheme} />);
    expect(screen.getByText('홍길동')).toBeDefined();
    expect(screen.getByText('김철수')).toBeDefined();
  });

  it('범인 캐릭터에 "범인" 라벨이 표시된다', () => {
    render(<CharacterAssignPanel themeId="theme-1" theme={baseTheme} />);
    expect(screen.getByText('범인')).toBeDefined();
  });

  it('캐릭터 선택 시 단서 체크박스가 표시된다', () => {
    render(<CharacterAssignPanel themeId="theme-1" theme={baseTheme} />);
    fireEvent.click(screen.getByText('홍길동'));
    expect(screen.getByText('피 묻은 칼')).toBeDefined();
    expect(screen.getByText('비밀 편지')).toBeDefined();
  });

  it('단서 체크 시 mutate가 호출된다', async () => {
    render(<CharacterAssignPanel themeId="theme-1" theme={baseTheme} />);
    fireEvent.click(screen.getByText('홍길동'));

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    await act(async () => { vi.advanceTimersByTime(500); });
    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [config] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    const cc = config.character_clues as Record<string, string[]>;
    expect(cc['char-1']).toContain('clue-1');
  });

  it('미션 추가 버튼이 동작한다', async () => {
    render(<CharacterAssignPanel themeId="theme-1" theme={baseTheme} />);
    fireEvent.click(screen.getByText('홍길동'));
    fireEvent.click(screen.getByText('추가'));

    await act(async () => { vi.advanceTimersByTime(500); });
    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [config] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    const cm = config.character_missions as Record<string, unknown[]>;
    expect(cm['char-1']).toHaveLength(1);
  });

  it('캐릭터가 없으면 안내 메시지를 표시한다', () => {
    useEditorCharactersMock.mockReturnValue({ data: [], isLoading: false });
    render(<CharacterAssignPanel themeId="theme-1" theme={baseTheme} />);
    expect(screen.getByText('캐릭터를 먼저 추가하세요')).toBeDefined();
  });
});
