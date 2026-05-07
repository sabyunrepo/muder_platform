import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorThemeResponse } from '@/features/editor/api';

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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockActiveTab.current = 'storyMap';
});

describe('EditorLayout', () => {
  it('모바일 헤더에서 보조 정보는 숨기고 주요 액션은 유지한다', () => {
    const onValidate = vi.fn(() => []);
    const onPublish = vi.fn();

    render(
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
    expect((screen.getByRole('button', { name: '검증' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: '출판' }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: '검증' }));
    fireEvent.click(screen.getByRole('button', { name: '출판' }));

    expect(onValidate).toHaveBeenCalledTimes(1);
    expect(onPublish).toHaveBeenCalledTimes(1);
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
    expect(screen.getByText('출판됨')).toBeDefined();
  });

  it('저장 상태별 표시와 재시도 액션을 헤더 안에서 유지한다', () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <EditorLayout
        theme={baseTheme}
        themeId="theme-1"
        saveStatus="saving"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText('저장 중...')).toBeDefined();

    rerender(
      <EditorLayout
        theme={baseTheme}
        themeId="theme-1"
        saveStatus="error"
        onRetry={onRetry}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /저장 실패/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<EditorLayout theme={baseTheme} themeId="theme-1" saveStatus="idle" />);
    expect(screen.queryByText('저장 중...')).toBeNull();
    expect(screen.queryByRole('button', { name: /저장 실패/ })).toBeNull();
  });

  it('검증 결과를 표시하고 닫거나 관련 탭으로 이동할 수 있다', () => {
    const onValidate = vi.fn(() => [
      { type: 'error' as const, category: 'clues', message: '단서 연결이 필요합니다' },
      { type: 'warning' as const, category: 'modules', message: '모듈 설정을 확인하세요' },
    ]);

    render(
      <EditorLayout
        theme={baseTheme}
        themeId="theme-1"
        onValidate={onValidate}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '검증' }));

    expect(screen.getByText('검증 결과: 1개 오류, 1개 경고')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /단서 연결이 필요합니다/ }));

    expect(mockSetActiveTab).toHaveBeenCalledWith('clues');
    expect(screen.queryByText('검증 결과: 1개 오류, 1개 경고')).toBeNull();
  });

  it('Ctrl+S와 Cmd+S 저장 단축키만 저장 액션을 실행한다', () => {
    const onSave = vi.fn();

    render(
      <EditorLayout
        theme={baseTheme}
        themeId="theme-1"
        onSave={onSave}
      />,
    );

    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    fireEvent.keyDown(window, { key: 's', metaKey: true });

    expect(onSave).toHaveBeenCalledTimes(2);
  });
});
