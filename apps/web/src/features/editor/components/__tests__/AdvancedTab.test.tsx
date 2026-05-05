import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mutateMock, setActiveTabMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  setActiveTabMock: vi.fn(),
}));

vi.mock('@/features/editor/api', () => ({
  useValidateTheme: () => ({
    mutate: mutateMock,
    isPending: false,
  }),
}));

vi.mock('@/features/editor/stores/editorUIStore', () => ({
  useEditorUI: () => ({
    setActiveTab: setActiveTabMock,
  }),
}));

vi.mock('@/features/editor/validation', () => ({
  validateGameDesign: () => [
    { type: 'warning', category: '단서', message: '사용되지 않은 단서가 있습니다.' },
  ],
}));

import { AdvancedTab } from '../AdvancedTab';
import type { EditorThemeResponse } from '@/features/editor/api';

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
  config_json: { modules: ['deck_investigation'], secretInternalKey: 'hidden' },
  version: 1,
  created_at: '2026-05-05T00:00:00Z',
} satisfies EditorThemeResponse;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AdvancedTab', () => {
  it('제작자 기본 화면에서 raw config_json 편집기를 노출하지 않는다', () => {
    render(<AdvancedTab themeId="theme-1" theme={theme} />);

    expect(screen.getByText('제작 검수')).toBeDefined();
    expect(screen.queryByText('config_json')).toBeNull();
    expect(screen.queryByDisplayValue(/secretInternalKey/)).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: '저장' })).toBeNull();
  });

  it('검증 결과를 제작자용 문구로 표시한다', () => {
    mutateMock.mockImplementation((_vars, options) => {
      options.onSuccess({
        errors: ['등장인물을 1명 이상 추가하세요.'],
        stats: { clues: 0, characters: 0 },
      });
    });

    render(<AdvancedTab themeId="theme-1" theme={theme} />);
    fireEvent.click(screen.getByRole('button', { name: '지금 검증' }));

    expect(screen.getByText('등장인물을 1명 이상 추가하세요.')).toBeDefined();
    expect(screen.getByText('[단서] 사용되지 않은 단서가 있습니다.')).toBeDefined();
  });
});
