import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { EditorThemeResponse } from '@/features/editor/api';
import { editorDesignClassNames } from '@/features/editor/design-system/editorDesignTokens';
import { AppearanceProvider } from '@/shared/appearance';

const { mockNavigate, mockSetActiveTab, mockActiveTab } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSetActiveTab: vi.fn(),
  mockActiveTab: { current: 'storyMap' },
}));

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../stores/editorUIStore', () => ({
  useEditorUI: () => ({
    activeTab: mockActiveTab.current,
    setActiveTab: mockSetActiveTab,
  }),
}));

vi.mock('../EditorTabNav', () => ({
  EditorTabNav: () => <nav aria-label="에디터 탭">탭 내비게이션</nav>,
}));

vi.mock('../TabContent', () => ({
  TabContent: () => <div>탭 콘텐츠</div>,
}));

import { EditorLayout } from '../EditorLayout';

const baseTheme: EditorThemeResponse = {
  id: 'theme-1',
  title: '좁은 모바일 화면용 테스트 테마',
  slug: 'mobile-theme',
  description: null,
  cover_image: null,
  min_players: 4,
  max_players: 6,
  duration_min: 90,
  price: 0,
  coin_price: 0,
  status: 'DRAFT',
  config_json: null,
  version: 1,
  created_at: '2026-05-07T00:00:00Z',
  review_note: null,
  reviewed_at: null,
  reviewed_by: null,
};

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

beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: createStorage(),
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-theme-preference');
  document.documentElement.style.colorScheme = '';
  mockActiveTab.current = 'storyMap';
});

function renderEditorLayout(ui: ReactElement) {
  return render(<AppearanceProvider>{ui}</AppearanceProvider>);
}

describe('EditorLayout', () => {
  it('헤더에서 핵심 정보와 주요 액션을 유지한다', () => {
    const onValidate = vi.fn(() => []);
    const onPublish = vi.fn();

    renderEditorLayout(
      <EditorLayout
        theme={baseTheme}
        themeId="theme-1"
        saveStatus="dirty"
        onValidate={onValidate}
        onPublish={onPublish}
      />,
    );

    expect(screen.getByText('좁은 모바일 화면용 테스트 테마')).toBeDefined();
    expect(screen.getByText('초안')).toBeDefined();
    expect(screen.getByText('변경사항 있음')).toBeDefined();
    expect(screen.getByText('초안').className).toContain(editorDesignClassNames.tag);
    expect((screen.getByRole('button', { name: '검증' }) as HTMLButtonElement).disabled).toBe(
      false
    );
    expect((screen.getByRole('button', { name: '출판' }) as HTMLButtonElement).disabled).toBe(
      false
    );
    expect(screen.getByRole('button', { name: '검증' }).className).toContain(
      editorDesignClassNames.secondaryAction
    );
    expect(screen.getByRole('button', { name: '출판' }).className).toContain(
      editorDesignClassNames.primaryAction
    );

    fireEvent.click(screen.getByRole('button', { name: '검증' }));
    fireEvent.click(screen.getByRole('button', { name: '출판' }));

    expect(onValidate).toHaveBeenCalledTimes(2);
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it.each(['시스템', '라이트', '다크'] as const)(
    '에디터 상세 화면 모드에서 %s 버튼을 누르면 전역 preference를 변경한다',
    (label) => {
      renderEditorLayout(<EditorLayout theme={baseTheme} themeId="theme-1" />);

      fireEvent.click(screen.getByRole('button', { name: label }));

      const expectedPreference =
        label === '시스템' ? 'system' : label === '라이트' ? 'light' : 'dark';
      expect(document.documentElement.dataset.themePreference).toBe(expectedPreference);
    },
  );

  it('에디터 상세 화면 모드는 공용 compact toggle로 현재 선택값을 표시한다', () => {
    window.localStorage.setItem('mmp.appearance', 'dark');

    renderEditorLayout(<EditorLayout theme={baseTheme} themeId="theme-1" />);

    expect(screen.getByRole('group', { name: '에디터 화면 모드' })).toBeDefined();
    expect(screen.getByRole('button', { name: '다크' }).getAttribute('aria-pressed')).toBe(
      'true'
    );
    expect(screen.getByRole('button', { name: '라이트' }).getAttribute('aria-pressed')).toBe(
      'false'
    );
  });

  it('뒤로가기와 출판 완료 테마의 비활성 상태를 유지한다', () => {
    renderEditorLayout(
      <EditorLayout theme={{ ...baseTheme, status: 'PUBLISHED' }} themeId="theme-1" />,
    );

    fireEvent.click(screen.getByLabelText('에디터 목록으로 돌아가기'));

    expect(mockNavigate).toHaveBeenCalledWith('/editor');
    expect((screen.getByRole('button', { name: '출판' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('출판됨')).toBeDefined();
  });

  it('저장 상태별 표시와 재시도 액션을 헤더 안에서 유지한다', () => {
    const onRetry = vi.fn();
    const { rerender } = renderEditorLayout(
      <EditorLayout theme={baseTheme} themeId="theme-1" saveStatus="saving" onRetry={onRetry} />,
    );

    expect(screen.getByText('저장 중...')).toBeDefined();

    rerender(
      <AppearanceProvider>
        <EditorLayout theme={baseTheme} themeId="theme-1" saveStatus="error" onRetry={onRetry} />
      </AppearanceProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /저장 실패/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(
      <AppearanceProvider>
        <EditorLayout theme={baseTheme} themeId="theme-1" saveStatus="idle" />
      </AppearanceProvider>,
    );
    expect(screen.queryByText('저장 중...')).toBeNull();
    expect(screen.queryByRole('button', { name: /저장 실패/ })).toBeNull();
  });

  it('검증 결과를 표시하고 닫거나 관련 탭으로 이동할 수 있다', () => {
    const onValidate = vi.fn(() => [
      { type: 'error' as const, category: 'clues', message: '단서 연결이 필요합니다' },
      { type: 'warning' as const, category: 'modules', message: '모듈 설정을 확인하세요' },
    ]);

    renderEditorLayout(
      <EditorLayout theme={baseTheme} themeId="theme-1" onValidate={onValidate} />,
    );

    fireEvent.click(screen.getByRole('button', { name: '검증' }));

    expect(screen.getByText('검증 결과: 1개 오류, 1개 경고')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /단서 연결이 필요합니다/ }));

    expect(mockSetActiveTab).toHaveBeenCalledWith('clues');
    expect(screen.queryByText('검증 결과: 1개 오류, 1개 경고')).toBeNull();
  });

  it('출판 클릭 시 검증 오류가 있으면 안내를 표시하고 출판을 호출하지 않는다', () => {
    const onValidate = vi.fn(() => [
      { type: 'error' as const, category: 'phases', message: '페이즈가 설정되지 않았습니다' },
    ]);
    const onPublish = vi.fn();

    renderEditorLayout(
      <EditorLayout
        theme={baseTheme}
        themeId="theme-1"
        onValidate={onValidate}
        onPublish={onPublish}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '출판' }));

    expect(onValidate).toHaveBeenCalledTimes(1);
    expect(onPublish).not.toHaveBeenCalled();
    expect(screen.getByText('검증 결과: 1개 오류')).toBeDefined();
    expect(screen.getByText('검증 오류를 먼저 해결해야 출판할 수 있습니다')).toBeDefined();
  });

  it('출판 클릭 시 검증 오류가 없으면 출판을 호출한다', () => {
    const onValidate = vi.fn(() => []);
    const onPublish = vi.fn();

    renderEditorLayout(
      <EditorLayout
        theme={baseTheme}
        themeId="theme-1"
        onValidate={onValidate}
        onPublish={onPublish}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '출판' }));

    expect(onValidate).toHaveBeenCalledTimes(1);
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('검증 오류를 먼저 해결해야 출판할 수 있습니다')).toBeNull();
  });

  it('Ctrl+S와 Cmd+S 저장 단축키만 저장 액션을 실행한다', () => {
    const onSave = vi.fn();

    renderEditorLayout(<EditorLayout theme={baseTheme} themeId="theme-1" onSave={onSave} />);

    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    fireEvent.keyDown(window, { key: 's', metaKey: true });

    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it('스토리 진행 탭 콘텐츠는 검증 패널이 있어도 접근 가능하다', () => {
    renderEditorLayout(<EditorLayout theme={baseTheme} themeId="theme-1" />);

    const tabPanel = screen.getByRole('tabpanel');
    const root = tabPanel.parentElement;
    expect(root?.className).toContain(editorDesignClassNames.surface);
    expect(tabPanel).toBeDefined();
    expect(tabPanel.className).toContain('overflow-hidden');
    expect(screen.getByText('탭 콘텐츠')).toBeDefined();
  });

  it.each(['characters', 'info', 'clues', 'design', 'questions', 'endings', 'locations', 'media'])(
    '%s 탭은 내부 편집 화면이 스크롤을 맡도록 탭 패널을 고정한다',
    (tab) => {
      mockActiveTab.current = tab;

      renderEditorLayout(<EditorLayout theme={baseTheme} themeId="theme-1" />);

      const tabPanel = screen.getByRole('tabpanel');
      expect(tabPanel.id).toBe(`tabpanel-${tab}`);
      expect(tabPanel.className).toContain('min-h-0');
      expect(tabPanel.className).toContain('overflow-hidden');
    }
  );
});
