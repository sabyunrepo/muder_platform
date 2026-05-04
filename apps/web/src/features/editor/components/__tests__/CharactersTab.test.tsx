import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { useEditorCharactersMock, useDeleteCharacterMock, deleteMutateMock } = vi.hoisted(() => ({
  useEditorCharactersMock: vi.fn(),
  useDeleteCharacterMock: vi.fn(),
  deleteMutateMock: vi.fn(),
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
  CharacterForm: ({
    isOpen,
    character,
  }: {
    isOpen: boolean;
    character?: { name: string };
  }) => (isOpen ? <div role="dialog">{character ? `${character.name} 수정 폼` : '캐릭터 생성 폼'}</div> : null),
}));

vi.mock('@/shared/components/ui/Modal', () => ({
  Modal: ({
    children,
    footer,
    isOpen,
  }: {
    children: React.ReactNode;
    footer?: React.ReactNode;
    isOpen: boolean;
  }) => (isOpen ? <div role="dialog">{children}{footer}</div> : null),
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
  CharacterAssignPanel: ({
    onCreate,
    onEdit,
    onDelete,
  }: {
    onCreate?: () => void;
    onEdit?: (character: { id: string; name: string }) => void;
    onDelete?: (character: { id: string; name: string }) => void;
  }) => (
    <div>
      CharacterAssignPanel 콘텐츠
      <button type="button" onClick={onCreate}>캐릭터 추가</button>
      <button type="button" onClick={() => onEdit?.({ id: 'char-1', name: '탐정 A' })}>
        탐정 A 수정
      </button>
      <button type="button" onClick={() => onDelete?.({ id: 'char-1', name: '탐정 A' })}>
        탐정 A 삭제
      </button>
    </div>
  ),
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
    useDeleteCharacterMock.mockReturnValue({ mutate: deleteMutateMock, isPending: false });
  });

  it('서브탭 제작, 빠른 목록 2개를 렌더링한다', () => {
    render(<CharactersTab themeId="theme-1" theme={mockTheme} />);

    expect(screen.getByText('제작')).toBeDefined();
    expect(screen.getByText('빠른 목록')).toBeDefined();
  });

  it('기본 선택 탭은 새 제작 workspace다', () => {
    render(<CharactersTab themeId="theme-1" theme={mockTheme} />);

    const workspaceTab = screen.getByText('제작').closest('button');
    expect(workspaceTab?.className).toContain('border-amber-500');
    expect(screen.getByText('CharacterAssignPanel 콘텐츠')).toBeDefined();
  });

  it('빠른 목록 탭 클릭 시 캐릭터 목록 콘텐츠가 표시된다', () => {
    render(<CharactersTab themeId="theme-1" theme={mockTheme} />);

    fireEvent.click(screen.getByText('빠른 목록'));
    expect(screen.getByText('등장인물 없음')).toBeDefined();
  });

  it('빠른 목록에서 제작 탭으로 돌아가면 Entity workspace가 표시된다', () => {
    render(<CharactersTab themeId="theme-1" theme={mockTheme} />);

    fireEvent.click(screen.getByText('빠른 목록'));
    fireEvent.click(screen.getByText('제작'));
    expect(screen.getByText('CharacterAssignPanel 콘텐츠')).toBeDefined();
  });

  it('제작 workspace에서 캐릭터 생성 폼을 연다', () => {
    render(<CharactersTab themeId="theme-1" theme={mockTheme} />);

    fireEvent.click(screen.getByText('캐릭터 추가'));

    expect(screen.getByText('캐릭터 생성 폼')).toBeDefined();
  });

  it('제작 workspace에서 캐릭터 수정 폼을 연다', () => {
    render(<CharactersTab themeId="theme-1" theme={mockTheme} />);

    fireEvent.click(screen.getByText('탐정 A 수정'));

    expect(screen.getByText('탐정 A 수정 폼')).toBeDefined();
  });

  it('제작 workspace에서 캐릭터 삭제를 확정하면 delete mutation을 호출한다', () => {
    render(<CharactersTab themeId="theme-1" theme={mockTheme} />);

    fireEvent.click(screen.getByText('탐정 A 삭제'));
    fireEvent.click(screen.getByText('삭제'));

    expect(deleteMutateMock).toHaveBeenCalledWith('char-1', expect.any(Object));
  });
});
