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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('EditorPage', () => {
  it('id가 없으면 에디터 대시보드를 보여주고 overview 탭을 활성화한다', () => {
    paramsMock.mockReturnValue({});

    render(<EditorPage />);

    expect(screen.getByText('에디터 대시보드')).toBeDefined();
    expect(setActiveTabMock).toHaveBeenCalledWith('overview');
  });

  it('characters 라우트 segment를 characters 탭으로 매핑한다', () => {
    paramsMock.mockReturnValue({ id: 'theme-1', tab: 'characters' });

    render(<EditorPage />);

    expect(screen.getByText(/테마 에디터 theme-1 characters/)).toBeDefined();
    expect(setActiveTabMock).toHaveBeenCalledWith('characters');
  });

  it('modules 라우트 segment를 design 탭으로 매핑한다', () => {
    paramsMock.mockReturnValue({ id: 'theme-1', tab: 'modules' });

    render(<EditorPage />);

    expect(screen.getByText(/테마 에디터 theme-1 modules/)).toBeDefined();
    expect(setActiveTabMock).toHaveBeenCalledWith('design');
  });

  it('알 수 없는 segment는 overview 탭으로 되돌린다', () => {
    paramsMock.mockReturnValue({ id: 'theme-1', tab: 'unknown' });

    render(<EditorPage />);

    expect(screen.getByText(/테마 에디터 theme-1 unknown/)).toBeDefined();
    expect(setActiveTabMock).toHaveBeenCalledWith('overview');
  });
});
