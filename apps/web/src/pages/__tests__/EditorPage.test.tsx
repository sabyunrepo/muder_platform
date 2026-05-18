import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const { locationPathMock, paramsMock, setActiveTabMock } = vi.hoisted(() => ({
  locationPathMock: vi.fn(() => '/editor'),
  paramsMock: vi.fn(),
  setActiveTabMock: vi.fn(),
}));

vi.mock('react-router', () => ({
  useLocation: () => ({ pathname: locationPathMock() }),
  useParams: () => paramsMock(),
}));

vi.mock('@/features/editor/stores/editorUIStore', () => ({
  useEditorUI: (selector: (state: { setActiveTab: typeof setActiveTabMock }) => unknown) =>
    selector({ setActiveTab: setActiveTabMock }),
}));

vi.mock('@/features/editor/components', () => ({
  EditorDashboard: () => <div>에디터 대시보드</div>,
  ThemeEditor: ({
    themeId,
    routeSegment,
    appearancePreference,
    resolvedAppearance,
  }: {
    themeId: string;
    routeSegment?: string;
    appearancePreference?: string;
    resolvedAppearance?: string;
  }) => (
    <div>
      테마 에디터 {themeId} {routeSegment ?? 'no-segment'} {appearancePreference}{' '}
      {resolvedAppearance}
    </div>
  ),
}));

import EditorPage from '../EditorPage';
import { EDITOR_DESIGN_SCOPE_CLASS } from '@/features/editor/design-system/editorDesignTokens';
import { EDITOR_APPEARANCE_STORAGE_KEY } from '@/features/editor/design-system/useEditorAppearance';

const routeMatrixCases = [
  ['직접 URL /editor/:id', { id: 'theme-1' }, 'no-segment', 'storyMap'],
  ['alias URL /editor/:id/story-map', { id: 'theme-1', tab: 'story-map' }, 'story-map', 'storyMap'],
  ['직접 URL /editor/:id/story', { id: 'theme-1', tab: 'story' }, 'story', 'storyMap'],
  ['직접 URL /editor/:id/reading', { id: 'theme-1', tab: 'reading' }, 'reading', 'story'],
  ['직접 URL /editor/:id/info', { id: 'theme-1', tab: 'info' }, 'info', 'info'],
  [
    '직접 URL /editor/:id/characters',
    { id: 'theme-1', tab: 'characters' },
    'characters',
    'characters',
  ],
  ['직접 URL /editor/:id/clues', { id: 'theme-1', tab: 'clues' }, 'clues', 'clues'],
  ['직접 URL /editor/:id/relations', { id: 'theme-1', tab: 'relations' }, 'relations', 'clues'],
  ['직접 URL /editor/:id/media', { id: 'theme-1', tab: 'media' }, 'media', 'media'],
  ['직접 URL /editor/:id/overview', { id: 'theme-1', tab: 'overview' }, 'overview', 'overview'],
  ['legacy URL /editor/:id/template', { id: 'theme-1', tab: 'template' }, 'template', 'overview'],
  [
    'legacy URL /editor/:id/templates',
    { id: 'theme-1', tab: 'templates' },
    'templates',
    'overview',
  ],
  ['직접 URL /editor/:id/advanced', { id: 'theme-1', tab: 'advanced' }, 'advanced', 'advanced'],
  ['직접 URL /editor/:id/design', { id: 'theme-1', tab: 'design' }, 'design', 'design'],
  [
    'alias URL /editor/:id/design/modules',
    { id: 'theme-1', tab: 'design', designTab: 'modules' },
    'design/modules',
    'design',
  ],
  [
    'alias URL /editor/:id/design/flow',
    { id: 'theme-1', tab: 'design', designTab: 'flow' },
    'design/flow',
    'storyMap',
  ],
  [
    'alias URL /editor/:id/design/locations',
    { id: 'theme-1', tab: 'design', designTab: 'locations' },
    'design/locations',
    'locations',
  ],
  [
    'alias URL /editor/:id/design/endings',
    { id: 'theme-1', tab: 'design', designTab: 'endings' },
    'design/endings',
    'endings',
  ],
  ['alias URL /editor/:id/modules', { id: 'theme-1', tab: 'modules' }, 'modules', 'design'],
  ['alias URL /editor/:id/flow', { id: 'theme-1', tab: 'flow' }, 'flow', 'storyMap'],
  [
    'sample slug URL /editor/e2e-test-theme/flow',
    { id: 'e2e-test-theme', tab: 'flow' },
    'flow',
    'storyMap',
  ],
  ['직접 URL /editor/:id/locations', { id: 'theme-1', tab: 'locations' }, 'locations', 'locations'],
  ['직접 URL /editor/:id/endings', { id: 'theme-1', tab: 'endings' }, 'endings', 'endings'],
] as const;

function createStorage() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
}

function createMatchMediaController(initialMatches = false) {
  let matches = initialMatches;
  let listeners: Array<(event: { matches: boolean }) => void> = [];
  const matchMedia = vi.fn((media: string) => ({
    matches,
    media,
    onchange: null,
    addEventListener: vi.fn((_event: 'change', listener: (event: { matches: boolean }) => void) => {
      listeners.push(listener);
    }),
    removeEventListener: vi.fn(
      (_event: 'change', listener: (event: { matches: boolean }) => void) => {
        listeners = listeners.filter((candidate) => candidate !== listener);
      }
    ),
    addListener: vi.fn((listener: (event: { matches: boolean }) => void) => {
      listeners.push(listener);
    }),
    removeListener: vi.fn((listener: (event: { matches: boolean }) => void) => {
      listeners = listeners.filter((candidate) => candidate !== listener);
    }),
    dispatchEvent: vi.fn(),
  }));

  return {
    matchMedia,
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      listeners.forEach((listener) => listener({ matches: nextMatches }));
    },
  };
}

beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: createStorage(),
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  locationPathMock.mockReturnValue('/editor');
});

describe('EditorPage', () => {
  it('id가 없으면 에디터 대시보드를 보여주고 기본 제작 흐름 탭을 활성화한다', () => {
    paramsMock.mockReturnValue({});
    locationPathMock.mockReturnValue('/editor');

    const { container } = render(<EditorPage />);

    expect(screen.getByText('에디터 대시보드')).toBeDefined();
    expect(container.querySelector(`.${EDITOR_DESIGN_SCOPE_CLASS}`)).toBeNull();
    expect(setActiveTabMock).toHaveBeenCalledWith('storyMap');
  });

  it('/editor dashboard는 저장된 appearance mode와 시스템 dark 설정에도 legacy design으로 남는다', () => {
    const systemTheme = createMatchMediaController(true);
    vi.stubGlobal('matchMedia', systemTheme.matchMedia);
    window.localStorage.setItem(EDITOR_APPEARANCE_STORAGE_KEY, 'dark');
    paramsMock.mockReturnValue({});
    locationPathMock.mockReturnValue('/editor');

    const { container } = render(<EditorPage />);

    expect(screen.getByText('에디터 대시보드')).toBeDefined();
    expect(screen.queryByText(/테마 에디터/)).toBeNull();
    expect(container.querySelector(`.${EDITOR_DESIGN_SCOPE_CLASS}`)).toBeNull();
    expect(container.querySelector('[data-editor-theme]')).toBeNull();
    expect(container.querySelector('[data-editor-theme-preference]')).toBeNull();
    expect(systemTheme.matchMedia).not.toHaveBeenCalled();
  });

  it('characters 라우트 segment를 characters 탭으로 매핑한다', () => {
    paramsMock.mockReturnValue({ id: 'theme-1', tab: 'characters' });
    locationPathMock.mockReturnValue('/editor/theme-1/characters');

    render(<EditorPage />);

    const detail = screen.getByText(/테마 에디터 theme-1 characters system light/);
    expect(detail).toBeDefined();
    expect(detail.parentElement?.className).toContain(EDITOR_DESIGN_SCOPE_CLASS);
    expect(detail.parentElement?.getAttribute('data-editor-theme')).toBe('light');
    expect(detail.parentElement?.getAttribute('data-editor-theme-preference')).toBe('system');
    expect(setActiveTabMock).toHaveBeenCalledWith('characters');
  });

  it('에디터 상세 첫 로드에서 system appearance를 운영체제 dark 설정으로 해석한다', () => {
    const systemTheme = createMatchMediaController(true);
    vi.stubGlobal('matchMedia', systemTheme.matchMedia);
    paramsMock.mockReturnValue({ id: 'theme-1', tab: 'characters' });
    locationPathMock.mockReturnValue('/editor/theme-1/characters');

    render(<EditorPage />);

    const detail = screen.getByText(/테마 에디터 theme-1 characters system dark/);
    expect(detail).toBeDefined();
    expect(detail.parentElement?.className).toContain(EDITOR_DESIGN_SCOPE_CLASS);
    expect(detail.parentElement?.getAttribute('data-editor-theme')).toBe('dark');
    expect(detail.parentElement?.getAttribute('data-editor-theme-preference')).toBe('system');
  });

  it.each([
    ['system', false, 'light'],
    ['system', true, 'dark'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
  ] as const)(
    '%s appearance는 editor detail data-editor-theme에 concrete %s 값을 쓴다',
    (storedPreference, systemPrefersDark, expectedTheme) => {
      const systemTheme = createMatchMediaController(systemPrefersDark);
      vi.stubGlobal('matchMedia', systemTheme.matchMedia);
      window.localStorage.setItem(EDITOR_APPEARANCE_STORAGE_KEY, storedPreference);
      paramsMock.mockReturnValue({ id: 'theme-1', tab: 'characters' });
      locationPathMock.mockReturnValue('/editor/theme-1/characters');

      render(<EditorPage />);

      const detail = screen.getByText(
        new RegExp(`테마 에디터 theme-1 characters ${storedPreference} ${expectedTheme}`)
      );
      expect(detail.parentElement?.className).toContain(EDITOR_DESIGN_SCOPE_CLASS);
      expect(detail.parentElement?.getAttribute('data-editor-theme')).toBe(expectedTheme);
      expect(detail.parentElement?.getAttribute('data-editor-theme')).not.toBe('system');
      expect(detail.parentElement?.getAttribute('data-editor-theme-preference')).toBe(
        storedPreference
      );
    }
  );

  it('system appearance는 reload 없이 운영체제 색상 변경을 에디터 상세 wrapper에 반영한다', () => {
    const systemTheme = createMatchMediaController(false);
    vi.stubGlobal('matchMedia', systemTheme.matchMedia);
    paramsMock.mockReturnValue({ id: 'theme-1', tab: 'characters' });
    locationPathMock.mockReturnValue('/editor/theme-1/characters');

    render(<EditorPage />);

    let detail = screen.getByText(/테마 에디터 theme-1 characters system light/);
    const editorScope = detail.parentElement;
    expect(editorScope?.getAttribute('data-editor-theme')).toBe('light');

    act(() => {
      systemTheme.setMatches(true);
    });

    detail = screen.getByText(/테마 에디터 theme-1 characters system dark/);
    expect(detail.parentElement).toBe(editorScope);
    expect(editorScope?.getAttribute('data-editor-theme')).toBe('dark');
    expect(editorScope?.getAttribute('data-editor-theme-preference')).toBe('system');
  });

  it('에디터 상세 초기화 시 localStorage에 저장된 valid appearance mode를 복원한다', () => {
    window.localStorage.setItem(EDITOR_APPEARANCE_STORAGE_KEY, 'dark');
    paramsMock.mockReturnValue({ id: 'theme-1', tab: 'characters' });
    locationPathMock.mockReturnValue('/editor/theme-1/characters');

    render(<EditorPage />);

    const detail = screen.getByText(/테마 에디터 theme-1 characters dark dark/);
    expect(detail).toBeDefined();
    expect(detail.parentElement?.className).toContain(EDITOR_DESIGN_SCOPE_CLASS);
    expect(detail.parentElement?.getAttribute('data-editor-theme')).toBe('dark');
    expect(detail.parentElement?.getAttribute('data-editor-theme-preference')).toBe('dark');
  });

  it.each(routeMatrixCases)(
    '%s route matrix를 ThemeEditor와 active tab에 반영한다',
    (_label, params, expectedSegment, expectedTab) => {
      paramsMock.mockReturnValue(params);
      locationPathMock.mockReturnValue(
        expectedSegment === 'no-segment'
          ? `/editor/${params.id}`
          : `/editor/${params.id}/${expectedSegment}`
      );

      render(<EditorPage />);

      expect(
        screen.getByText(new RegExp(`테마 에디터 ${params.id} ${expectedSegment}`))
      ).toBeDefined();
      expect(setActiveTabMock).toHaveBeenCalledWith(expectedTab);
    }
  );

  it('design 하위 route segment를 전체 direct URL segment로 전달한다', () => {
    paramsMock.mockReturnValue({ id: 'theme-1', tab: 'design', designTab: 'flow' });
    locationPathMock.mockReturnValue('/editor/theme-1/design/flow');

    render(<EditorPage />);

    expect(screen.getByText(/테마 에디터 theme-1 design\/flow/)).toBeDefined();
    expect(setActiveTabMock).toHaveBeenCalledWith('storyMap');
  });

  it('modules 라우트 segment를 design 탭으로 매핑한다', () => {
    paramsMock.mockReturnValue({ id: 'theme-1', tab: 'modules' });
    locationPathMock.mockReturnValue('/editor/theme-1/modules');

    render(<EditorPage />);

    expect(setActiveTabMock).toHaveBeenCalledWith('design');
  });

  it('알 수 없는 segment는 기본 제작 흐름 탭으로 되돌린다', () => {
    paramsMock.mockReturnValue({ id: 'theme-1', tab: 'unknown' });
    locationPathMock.mockReturnValue('/editor/theme-1/unknown');

    render(<EditorPage />);

    expect(screen.getByText(/테마 에디터 theme-1 unknown/)).toBeDefined();
    expect(setActiveTabMock).toHaveBeenCalledWith('storyMap');
  });
});
