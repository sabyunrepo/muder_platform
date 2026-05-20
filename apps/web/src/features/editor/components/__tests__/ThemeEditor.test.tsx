import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  useEditorThemeMock,
  usePublishThemeMock,
  useEditorCluesMock,
  useClueEdgesMock,
  useFlowGraphMock,
  validateGameDesignMock,
  validateClueGraphMock,
  editorLayoutMock,
} = vi.hoisted(() => ({
  useEditorThemeMock: vi.fn(),
  usePublishThemeMock: vi.fn(),
  useEditorCluesMock: vi.fn(),
  useClueEdgesMock: vi.fn(),
  useFlowGraphMock: vi.fn(),
  validateGameDesignMock: vi.fn(),
  validateClueGraphMock: vi.fn(),
  editorLayoutMock: vi.fn(),
}));

vi.mock('@/features/editor/api', () => ({
  useEditorTheme: (themeId: string) => useEditorThemeMock(themeId),
  usePublishTheme: (themeId: string) => usePublishThemeMock(themeId),
}));

vi.mock('@/features/editor/editorClueApi', () => ({
  useEditorClues: (themeId: string) => useEditorCluesMock(themeId),
}));

vi.mock('@/features/editor/clueEdgeApi', () => ({
  useClueEdges: (themeId: string) => useClueEdgesMock(themeId),
}));

vi.mock('@/features/editor/flowApi', () => ({
  useFlowGraph: (themeId: string) => useFlowGraphMock(themeId),
}));

vi.mock('@/features/editor/validation', () => ({
  validateGameDesign: (...args: unknown[]) => validateGameDesignMock(...args),
  validateClueGraph: (...args: unknown[]) => validateClueGraphMock(...args),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../EditorLayout', () => ({
  EditorLayout: (props: Record<string, unknown>) => {
    editorLayoutMock(props);
    return <div>EditorLayout {String(props.routeSegment)}</div>;
  },
}));

import { ThemeEditor } from '../ThemeEditor';
import { ApiHttpError } from '@/lib/api-error';

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
    useFlowGraphMock.mockReturnValue({
      data: {
        nodes: [{ id: 'phase-1', type: 'phase', data: { label: '1라운드' } }],
        edges: [],
      },
    });
    usePublishThemeMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
    validateGameDesignMock.mockReturnValue(['game-warning']);
    validateClueGraphMock.mockReturnValue(['graph-warning']);
  });

  it('로딩 중이면 전체 화면 스피너를 표시한다', () => {
    useEditorThemeMock.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    const { container } = render(<ThemeEditor themeId="theme-1" />);

    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });

  it('테마 로드 실패 시 오류 메시지를 표시한다', () => {
    useEditorThemeMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    render(<ThemeEditor themeId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" />);

    expect(screen.getByText('테마를 찾을 수 없습니다')).toBeDefined();
    expect(screen.getByText(/편집 권한이 없는 테마/)).toBeDefined();
  });

  it('slug 주소 로드 실패 시 seed 확인 메시지를 표시한다', () => {
    useEditorThemeMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    render(<ThemeEditor themeId="e2e-test-theme" />);

    expect(screen.getByText('샘플 또는 slug 테마를 찾을 수 없습니다')).toBeDefined();
    expect(screen.getByText(/e2e-test-theme seed/)).toBeDefined();
  });

  it('서버가 invalid locator를 반환하면 주소 형식 메시지를 표시한다', () => {
    useEditorThemeMock.mockReturnValue({
      data: undefined,
      error: new ApiHttpError({
        type: 'about:blank',
        code: 'BAD_REQUEST',
        status: 400,
        title: 'Bad Request',
        detail: 'invalid theme locator',
      }),
      isLoading: false,
      isError: true,
    });

    render(<ThemeEditor themeId="bad_slug!" />);

    expect(screen.getByText('테마 주소 형식이 올바르지 않습니다')).toBeDefined();
    expect(screen.getByText(/영문 소문자, 숫자, 하이픈/)).toBeDefined();
  });

  it('서버가 forbidden을 반환하면 권한 메시지를 표시한다', () => {
    useEditorThemeMock.mockReturnValue({
      data: undefined,
      error: new ApiHttpError({
        type: 'about:blank',
        code: 'FORBIDDEN',
        status: 403,
        title: 'Forbidden',
        detail: 'you do not own this theme',
      }),
      isLoading: false,
      isError: true,
    });

    render(<ThemeEditor themeId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" />);

    expect(screen.getByText('테마 편집 권한이 없습니다')).toBeDefined();
    expect(screen.getByText(/현재 로그인한 계정/)).toBeDefined();
  });

  it('routeSegment를 EditorLayout으로 전달하고 검증 결과를 합친다', () => {
    render(<ThemeEditor themeId="theme-1" routeSegment="modules" />);

    expect(screen.getByText('EditorLayout modules')).toBeDefined();
    expect(useEditorThemeMock).toHaveBeenCalledWith('theme-1');
    expect(useEditorCluesMock).toHaveBeenCalledWith('theme-1');
    expect(useClueEdgesMock).toHaveBeenCalledWith('theme-1');
    const props = editorLayoutMock.mock.calls[0][0] as {
      onValidate: () => string[];
      routeSegment: string;
      themeId: string;
    };
    expect(props.routeSegment).toBe('modules');
    expect(props.themeId).toBe('theme-1');
    expect(props.onValidate()).toEqual(['game-warning', 'graph-warning']);
    expect(validateGameDesignMock).toHaveBeenCalledWith(
      theme.config_json,
      1,
      1,
      expect.objectContaining({
        flowNodes: [{ id: 'phase-1', type: 'phase', data: { label: '1라운드' } }],
      })
    );
  });

  it('EditorLayout에 direct publish handler와 publish pending 상태를 전달한다', () => {
    const mutate = vi.fn();
    usePublishThemeMock.mockReturnValue({ mutate, isPending: true });

    render(<ThemeEditor themeId="theme-1" />);

    const props = editorLayoutMock.mock.calls[0][0] as {
      onPublish: () => void;
      isPublishing: boolean;
    };
    expect(usePublishThemeMock).toHaveBeenCalledWith('theme-1');
    expect(props.isPublishing).toBe(true);

    props.onPublish();

    expect(mutate).toHaveBeenCalledWith(undefined, expect.any(Object));
  });

  it('slug로 열린 뒤 하위 편집 API에는 응답의 UUID를 사용한다', () => {
    useEditorThemeMock.mockReturnValue({
      data: { ...theme, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      isLoading: false,
      isError: false,
    });

    render(<ThemeEditor themeId="e2e-test-theme" routeSegment="flow" />);

    expect(useEditorThemeMock).toHaveBeenCalledWith('e2e-test-theme');
    expect(useEditorCluesMock).toHaveBeenCalledWith('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(useClueEdgesMock).toHaveBeenCalledWith('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(useFlowGraphMock).toHaveBeenCalledWith('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(usePublishThemeMock).toHaveBeenCalledWith('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    const props = editorLayoutMock.mock.calls[0][0] as { themeId: string };
    expect(props.themeId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });
});
