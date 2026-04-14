import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { useEditorCharactersMock, useDeleteCharacterMock } = vi.hoisted(() => ({
  useEditorCharactersMock: vi.fn(),
  useDeleteCharacterMock: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/features/editor/api', () => ({
  useEditorCharacters: () => useEditorCharactersMock(),
  useDeleteCharacter: () => useDeleteCharacterMock(),
  useEditorClues: () => ({ data: [], isLoading: false }),
  useUpdateConfigJson: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../CharacterForm', () => ({
  CharacterForm: () => null,
}));

vi.mock('@/shared/components/ui/Modal', () => ({
  Modal: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
    isOpen ? <div>{children}</div> : null,
}));

vi.mock('@/shared/components/ui/Spinner', () => ({
  Spinner: () => <div>로딩 중...</div>,
}));

vi.mock('@/shared/components/ui/Button', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
}));

vi.mock('../design/CharacterAssignPanel', () => ({
  CharacterAssignPanel: () => <div>CharacterAssignPanel 콘텐츠</div>,
}));

vi.mock('../design/MissionEditor', () => ({
  MissionEditor: () => null,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { CharactersTab } from '../CharactersTab';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockTheme = {
  id: 'theme-1',
  title: '테스트 테마',
  slug: 'test-theme',
  description: '테스트 설명',
  cover_image: null,
  min_players: 4,
  max_players: 6,
  duration_min: 90,
  price: 0,
  status: 'DRAFT' as const,
  config_json: {},
  version: 1,
  created_at: '2026-04-05T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CharactersTab', () => {
  beforeEach(() => {
    useEditorCharactersMock.mockReturnValue({ data: [], isLoading: false });
    useDeleteCharacterMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it('서브탭 목록, 배정 2개를 렌더링한다', () => {
    render(<CharactersTab themeId="theme-1" theme={mockTheme} />);

    expect(screen.getByText('목록')).toBeDefined();
    expect(screen.getByText('배정')).toBeDefined();
  });

  it('기본 선택 탭은 목록이다', () => {
    render(<CharactersTab themeId="theme-1" theme={mockTheme} />);

    const listTab = screen.getByText('목록').closest('button');
    expect(listTab?.className).toContain('border-amber-500');
  });

  it('배정 탭 클릭 시 CharacterAssignPanel이 표시된다', () => {
    render(<CharactersTab themeId="theme-1" theme={mockTheme} />);

    fireEvent.click(screen.getByText('배정'));
    expect(screen.getByText('CharacterAssignPanel 콘텐츠')).toBeDefined();
  });

  it('목록 탭 클릭 시 캐릭터 목록 콘텐츠가 표시된다', () => {
    render(<CharactersTab themeId="theme-1" theme={mockTheme} />);

    fireEvent.click(screen.getByText('배정'));
    fireEvent.click(screen.getByText('목록'));
    expect(screen.getByText('등장인물 없음')).toBeDefined();
  });
});
