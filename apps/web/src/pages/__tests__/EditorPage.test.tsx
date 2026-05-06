import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { paramsMock, setActiveTabMock } = vi.hoisted(() => ({
  paramsMock: vi.fn(),
  setActiveTabMock: vi.fn(),
}));

vi.mock('react-router', () => ({
  useParams: () => paramsMock(),
}));

vi.mock('@/features/editor/stores/editorUIStore', () => ({
  useEditorUI: (selector: (state: { setActiveTab: typeof setActiveTabMock }) => unknown) =>
    selector({ setActiveTab: setActiveTabMock }),
}));

vi.mock('@/features/editor/components', () => ({
  EditorDashboard: () => <div>에디터 대시보드</div>,
  ThemeEditor: ({ themeId, routeSegment }: { themeId: string; routeSegment?: string }) => (
    <div>
      테마 에디터 {themeId} {routeSegment ?? 'no-segment'}
    </div>
  ),
}));

import EditorPage from '../EditorPage';

const routeMatrixCases = [
  ['직접 URL /editor/:id', { id: 'theme-1' }, 'no-segment', 'storyMap'],
  ['alias URL /editor/:id/story-map', { id: 'theme-1', tab: 'story-map' }, 'story-map', 'storyMap'],
  ['직접 URL /editor/:id/story', { id: 'theme-1', tab: 'story' }, 'story', 'storyMap'],
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
  ['직접 URL /editor/:id/template', { id: 'theme-1', tab: 'template' }, 'template', 'template'],
  ['alias URL /editor/:id/templates', { id: 'theme-1', tab: 'templates' }, 'templates', 'template'],
  ['직접 URL /editor/:id/advanced', { id: 'theme-1', tab: 'advanced' }, 'advanced', 'advanced'],
  [
    '직접 URL /editor/:id/design/modules',
    { id: 'theme-1', tab: 'design', designTab: 'modules' },
    'modules',
    'design',
  ],
  [
    '직접 URL /editor/:id/design/flow',
    { id: 'theme-1', tab: 'design', designTab: 'flow' },
    'flow',
    'design',
  ],
  [
    '직접 URL /editor/:id/design/locations',
    { id: 'theme-1', tab: 'design', designTab: 'locations' },
    'locations',
    'design',
  ],
  [
    '직접 URL /editor/:id/design/endings',
    { id: 'theme-1', tab: 'design', designTab: 'endings' },
    'endings',
    'design',
  ],
  ['alias URL /editor/:id/modules', { id: 'theme-1', tab: 'modules' }, 'modules', 'design'],
  ['alias URL /editor/:id/flow', { id: 'theme-1', tab: 'flow' }, 'flow', 'storyMap'],
  ['alias URL /editor/:id/locations', { id: 'theme-1', tab: 'locations' }, 'locations', 'design'],
  ['alias URL /editor/:id/endings', { id: 'theme-1', tab: 'endings' }, 'endings', 'design'],
] as const;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('EditorPage', () => {
  it('id가 없으면 에디터 대시보드를 보여주고 기본 제작 흐름 탭을 활성화한다', () => {
    paramsMock.mockReturnValue({});

    render(<EditorPage />);

    expect(screen.getByText('에디터 대시보드')).toBeDefined();
    expect(setActiveTabMock).toHaveBeenCalledWith('storyMap');
  });

  it('characters 라우트 segment를 characters 탭으로 매핑한다', () => {
    paramsMock.mockReturnValue({ id: 'theme-1', tab: 'characters' });

    render(<EditorPage />);

    expect(screen.getByText(/테마 에디터 theme-1 characters/)).toBeDefined();
    expect(setActiveTabMock).toHaveBeenCalledWith('characters');
  });

  it.each(routeMatrixCases)(
    '%s route matrix를 ThemeEditor와 active tab에 반영한다',
    (_label, params, expectedSegment, expectedTab) => {
      paramsMock.mockReturnValue(params);

      render(<EditorPage />);

      expect(screen.getByText(new RegExp(`테마 에디터 theme-1 ${expectedSegment}`))).toBeDefined();
      expect(setActiveTabMock).toHaveBeenCalledWith(expectedTab);
    }
  );

  it('design 하위 route segment를 실제 DesignTab subtab segment로 전달한다', () => {
    paramsMock.mockReturnValue({ id: 'theme-1', tab: 'design', designTab: 'flow' });

    render(<EditorPage />);

    expect(screen.getByText(/테마 에디터 theme-1 flow/)).toBeDefined();
    expect(setActiveTabMock).toHaveBeenCalledWith('design');
  });

  it('modules 라우트 segment를 design 탭으로 매핑한다', () => {
    paramsMock.mockReturnValue({ id: 'theme-1', tab: 'modules' });

    render(<EditorPage />);

    expect(setActiveTabMock).toHaveBeenCalledWith('design');
  });

  it('알 수 없는 segment는 기본 제작 흐름 탭으로 되돌린다', () => {
    paramsMock.mockReturnValue({ id: 'theme-1', tab: 'unknown' });

    render(<EditorPage />);

    expect(screen.getByText(/테마 에디터 theme-1 unknown/)).toBeDefined();
    expect(setActiveTabMock).toHaveBeenCalledWith('storyMap');
  });
});
