import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { useEditorCluesMock, useDeleteClueMock } = vi.hoisted(() => ({
  useEditorCluesMock: vi.fn(),
  useDeleteClueMock: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() }),
  QueryClient: class {
    invalidateQueries() {}
    setQueryData() {}
  },
}));
vi.mock('@/shared/components/ui/Spinner', () => ({
  Spinner: () => <div data-testid="spinner" />,
}));
vi.mock('@/shared/components/ui/Modal', () => ({
  Modal: ({ isOpen, children, footer, title }: { isOpen: boolean; children: React.ReactNode; footer: React.ReactNode; title: string }) =>
    isOpen ? <div role="dialog" aria-label={title}>{children}{footer}</div> : null,
}));
vi.mock('@/shared/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));
vi.mock('@/features/editor/api', () => ({
  useEditorClues: () => useEditorCluesMock(),
  useDeleteClue: () => useDeleteClueMock(),
  editorKeys: { clues: (id: string) => ['clues', id] },
}));
vi.mock('../ClueForm', () => ({
  ClueForm: () => null,
}));
vi.mock('../ImageUpload', () => ({
  ImageUpload: () => null,
}));
vi.mock('../ClueCard', () => ({
  ClueCard: ({ clue, onDelete }: { clue: { id: string; name: string; is_common: boolean }; onDelete: (c: unknown) => void }) => (
    <div data-testid={`clue-card-${clue.id}`}>
      <span>{clue.name}</span>
      {clue.is_common && <span>공통</span>}
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { CluesTab } from '../CluesTab';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockClues = [
  { id: 'clue-1', name: '피 묻은 칼', clue_type: 'physical', level: 1, is_common: false, description: '', image_url: null },
  { id: 'clue-2', name: '비밀 편지', clue_type: 'document', level: 2, is_common: true, description: '중요 편지', image_url: 'http://example.com/img.jpg' },
];

afterEach(cleanup);

describe('CluesTab', () => {
  beforeEach(() => {
    useDeleteClueMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it('로딩 중이면 스피너를 렌더링한다', () => {
    useEditorCluesMock.mockReturnValue({ data: undefined, isLoading: true });
    render(<CluesTab themeId="theme-1" />);
    expect(screen.getByTestId('spinner')).toBeDefined();
  });

  it('단서가 없으면 빈 상태를 표시한다', () => {
    useEditorCluesMock.mockReturnValue({ data: [], isLoading: false });
    render(<CluesTab themeId="theme-1" />);
    expect(screen.getByText('단서 없음')).toBeDefined();
  });

  it('단서 목록을 그리드로 렌더링한다', () => {
    useEditorCluesMock.mockReturnValue({ data: mockClues, isLoading: false });
    render(<CluesTab themeId="theme-1" />);
    expect(screen.getByText('피 묻은 칼')).toBeDefined();
    expect(screen.getByText('비밀 편지')).toBeDefined();
  });

  it('리스트 뷰 토글 시 ClueListRow로 렌더링된다', () => {
    useEditorCluesMock.mockReturnValue({ data: mockClues, isLoading: false });
    render(<CluesTab themeId="theme-1" />);
    fireEvent.click(screen.getByLabelText('리스트 뷰'));
    // ClueListRow renders type badge as mono text
    expect(screen.getAllByText('피 묻은 칼').length).toBeGreaterThan(0);
  });

  it('그리드 뷰 토글 버튼이 있다', () => {
    useEditorCluesMock.mockReturnValue({ data: mockClues, isLoading: false });
    render(<CluesTab themeId="theme-1" />);
    expect(screen.getByLabelText('그리드 뷰')).toBeDefined();
  });

  it('공통 단서에 공통 badge가 표시된다', () => {
    useEditorCluesMock.mockReturnValue({ data: mockClues, isLoading: false });
    render(<CluesTab themeId="theme-1" />);
    expect(screen.getByText('공통')).toBeDefined();
  });

  it('단서 개수를 표시한다', () => {
    useEditorCluesMock.mockReturnValue({ data: mockClues, isLoading: false });
    render(<CluesTab themeId="theme-1" />);
    expect(screen.getByText('2개의 단서')).toBeDefined();
  });
});
