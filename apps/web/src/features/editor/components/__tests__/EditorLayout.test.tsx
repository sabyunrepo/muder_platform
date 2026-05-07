import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorThemeResponse } from '@/features/editor/api';

const { mockNavigate, mockActiveTab } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockActiveTab: { current: 'storyMap' },
}));

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../stores/editorUIStore', () => ({
  useEditorUI: () => ({
    activeTab: mockActiveTab.current,
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockActiveTab.current = 'storyMap';
});

describe('EditorLayout', () => {
  it('모바일 헤더에서 보조 정보는 숨기고 주요 액션은 유지한다', () => {
    const onValidate = vi.fn(() => []);
    const onPublish = vi.fn();

    const { container } = render(
      <EditorLayout
        theme={baseTheme}
        themeId="theme-1"
        saveStatus="dirty"
        onValidate={onValidate}
        onPublish={onPublish}
      />,
    );

    expect(container.querySelector('header')?.className).toContain('gap-2');
    expect(container.querySelector('header')?.className).toContain('px-2');
    expect(screen.getByText('에디터').className).toContain('hidden');
    expect(screen.getByText('초안').className).toContain('hidden');
    expect(screen.getByText('변경사항 있음').closest('div')?.parentElement?.className).toContain(
      'hidden sm:block',
    );

    fireEvent.click(screen.getByRole('button', { name: '검증' }));
    fireEvent.click(screen.getByRole('button', { name: '출판' }));

    expect(onValidate).toHaveBeenCalledTimes(1);
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '검증' }).className).toContain('sm:h-7');
    expect(screen.getByRole('button', { name: '출판' }).className).toContain('sm:h-7');
  });

  it('뒤로가기와 출판 완료 테마의 비활성 상태를 유지한다', () => {
    render(
      <EditorLayout
        theme={{ ...baseTheme, status: 'PUBLISHED' }}
        themeId="theme-1"
      />,
    );

    fireEvent.click(screen.getByLabelText('에디터 목록으로 돌아가기'));

    expect(mockNavigate).toHaveBeenCalledWith('/editor');
    expect((screen.getByRole('button', { name: '출판' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('출판됨').className).toContain('hidden');
  });
});
