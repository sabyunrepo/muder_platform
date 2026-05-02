import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  useEditorThemeMock,
  useEditorCluesMock,
  useClueEdgesMock,
  editorLayoutMock,
} = vi.hoisted(() => ({
  useEditorThemeMock: vi.fn(),
  useEditorCluesMock: vi.fn(),
  useClueEdgesMock: vi.fn(),
  editorLayoutMock: vi.fn(),
}));

vi.mock('@/features/editor/api', () => ({
  useEditorTheme: (themeId: string) => useEditorThemeMock(themeId),
}));

vi.mock('@/features/editor/editorClueApi', () => ({
  useEditorClues: (themeId: string) => useEditorCluesMock(themeId),
}));

vi.mock('@/features/editor/clueEdgeApi', () => ({
  useClueEdges: (themeId: string) => useClueEdgesMock(themeId),
}));

vi.mock('@/features/editor/validation', () => ({
  validateGameDesign: () => ['game-warning'],
  validateClueGraph: () => ['graph-warning'],
}));

vi.mock('../EditorLayout', () => ({
  EditorLayout: (props: Record<string, unknown>) => {
    editorLayoutMock(props);
    return <div>EditorLayout {String(props.routeSegment)}</div>;
  },
}));

import { ThemeEditor } from '../ThemeEditor';

const theme = {
  id: 'theme-1',
  title: '테스트 테마',
  slug: 'test-theme',
  description: '',
  cover_image: null,
  min_players: 4,
  max_players: 6,
  duration_min: 90,
  price: 0,
  status: 'DRAFT',
  config_json: { characters: [{ id: 'char-1' }] },
  version: 1,
  created_at: '2026-05-02T00:00:00Z',
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ThemeEditor', () => {
  beforeEach(() => {
    useEditorThemeMock.mockReturnValue({ data: theme, isLoading: false, isError: false });
    useEditorCluesMock.mockReturnValue({ data: [{ id: 'clue-1', name: '단서 A' }] });
    useClueEdgesMock.mockReturnValue({
      data: [{ targetId: 'clue-1', mode: 'requires', sources: ['clue-2', 'clue-3'] }],
    });
  });

  it('로딩 중이면 전체 화면 스피너를 표시한다', () => {
    useEditorThemeMock.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    const { container } = render(<ThemeEditor themeId="theme-1" />);

    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });

  it('테마 로드 실패 시 오류 메시지를 표시한다', () => {
    useEditorThemeMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    render(<ThemeEditor themeId="theme-1" />);

    expect(screen.getByText('테마를 찾을 수 없습니다')).toBeDefined();
  });

  it('routeSegment를 EditorLayout으로 전달하고 검증 결과를 합친다', () => {
    render(<ThemeEditor themeId="theme-1" routeSegment="modules" />);

    expect(screen.getByText('EditorLayout modules')).toBeDefined();
    const props = editorLayoutMock.mock.calls[0][0] as { onValidate: () => string[]; routeSegment: string };
    expect(props.routeSegment).toBe('modules');
    expect(props.onValidate()).toEqual(['game-warning', 'graph-warning']);
  });
});
