import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  useEditorCluesMock,
  useDeleteClueMock,
  useEditorThemeMock,
  useEditorLocationsMock,
  useEditorCharactersMock,
  useUpdateConfigJsonMock,
} = vi.hoisted(() => ({
  useEditorCluesMock: vi.fn(),
  useDeleteClueMock: vi.fn(),
  useEditorThemeMock: vi.fn(),
  useEditorLocationsMock: vi.fn(),
  useEditorCharactersMock: vi.fn(),
  useUpdateConfigJsonMock: vi.fn(),
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
  useEditorTheme: () => useEditorThemeMock(),
  useEditorLocations: () => useEditorLocationsMock(),
  useEditorCharacters: () => useEditorCharactersMock(),
  useUpdateConfigJson: () => useUpdateConfigJsonMock(),
  editorKeys: { clues: (id: string) => ['clues', id] },
}));
vi.mock('../ClueForm', () => ({
  ClueForm: () => null,
}));
vi.mock('../ImageUpload', () => ({
  ImageUpload: () => null,
}));
vi.mock('../clues/ClueEdgeGraph', () => ({
  ClueEdgeGraph: () => <div>단서 관계 그래프</div>,
}));
// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { CluesTab } from '../CluesTab';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockClues = [
  { id: 'clue-1', name: '피 묻은 칼', level: 1, is_common: false, description: '', image_url: null },
  { id: 'clue-2', name: '비밀 편지', level: 2, is_common: true, description: '중요 편지', image_url: 'http://example.com/img.jpg' },
];

afterEach(cleanup);

describe('CluesTab', () => {
  beforeEach(() => {
    useDeleteClueMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
    useEditorThemeMock.mockReturnValue({ data: { config_json: {} } });
    useEditorLocationsMock.mockReturnValue({ data: [] });
    useEditorCharactersMock.mockReturnValue({ data: [] });
    useUpdateConfigJsonMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
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

  it('단서 목록과 선택된 단서 상세를 함께 렌더링한다', () => {
    useEditorCluesMock.mockReturnValue({ data: mockClues, isLoading: false });
    render(<CluesTab themeId="theme-1" />);
    expect(screen.getAllByText('피 묻은 칼').length).toBeGreaterThan(0);
    expect(screen.getByText('단서 상세')).toBeDefined();
    expect(screen.getByText('이 단서가 쓰이는 곳')).toBeDefined();
  });

  it('단서 검색 입력이 있다', () => {
    useEditorCluesMock.mockReturnValue({ data: mockClues, isLoading: false });
    render(<CluesTab themeId="theme-1" />);
    expect(screen.getByLabelText('단서 검색')).toBeDefined();
  });

  it('공통 단서에 제작자 친화적인 공개 범위 badge가 표시된다', () => {
    useEditorCluesMock.mockReturnValue({ data: mockClues, isLoading: false });
    render(<CluesTab themeId="theme-1" />);
    expect(screen.getByText('모두에게 공개')).toBeDefined();
  });

  it('단서 개수를 표시한다', () => {
    useEditorCluesMock.mockReturnValue({ data: mockClues, isLoading: false });
    render(<CluesTab themeId="theme-1" />);
    expect(screen.getByText('2개의 단서')).toBeDefined();
  });

  it('relations routeSegment로 직접 진입하면 관계 서브탭을 연다', () => {
    useEditorCluesMock.mockReturnValue({ data: mockClues, isLoading: false });

    render(<CluesTab themeId="theme-1" routeSegment="relations" />);

    expect(screen.getByText('단서 관계 그래프')).toBeDefined();
  });
});
