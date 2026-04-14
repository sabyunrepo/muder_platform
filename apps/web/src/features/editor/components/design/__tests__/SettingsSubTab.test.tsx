import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mutateMock, useUpdateConfigJsonMock, useModuleSchemasMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  useUpdateConfigJsonMock: vi.fn(),
  useModuleSchemasMock: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/features/editor/api', () => ({
  useModuleSchemas: () => useModuleSchemasMock(),
  useUpdateConfigJson: () => useUpdateConfigJsonMock(),
}));

vi.mock('@/features/editor/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/editor/constants')>();
  return { ...actual };
});

vi.mock('@/features/editor/templateApi', () => ({}));

vi.mock('@/features/editor/components/SchemaDrivenForm', () => ({
  SchemaDrivenForm: ({ schema }: { schema: { title?: string } }) => (
    <div data-testid="schema-driven-form">{schema?.title ?? 'form'}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { SettingsSubTab } from '../SettingsSubTab';
import type { EditorThemeResponse } from '@/features/editor/api';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const baseTheme: EditorThemeResponse = {
  id: 'theme-1',
  title: '테스트 테마',
  slug: 'test-theme',
  description: null,
  cover_image: null,
  min_players: 4,
  max_players: 6,
  duration_min: 90,
  price: 0,
  coin_price: 0,
  status: 'DRAFT',
  config_json: { modules: ['voting', 'accusation'] },
  version: 1,
  created_at: '2026-04-13T00:00:00Z',
  review_note: null,
  reviewed_at: null,
  reviewed_by: null,
};

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  useUpdateConfigJsonMock.mockReturnValue({ mutate: mutateMock, isPending: false });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SettingsSubTab', () => {
  it('로딩 상태일 때 "스키마 로딩 중..." 텍스트가 표시된다', () => {
    useModuleSchemasMock.mockReturnValue({ data: undefined, isLoading: true });

    render(<SettingsSubTab themeId="theme-1" theme={baseTheme} />);

    expect(screen.getByText('스키마 로딩 중...')).toBeDefined();
  });

  it('스키마가 없으면 "설정 가능한 모듈이 없습니다" 메시지가 표시된다', () => {
    useModuleSchemasMock.mockReturnValue({
      data: { schemas: {} },
      isLoading: false,
    });

    render(<SettingsSubTab themeId="theme-1" theme={baseTheme} />);

    expect(screen.getByText('설정 가능한 모듈이 없습니다')).toBeDefined();
  });

  it('스키마 있는 모듈에 SchemaDrivenForm이 렌더링된다', () => {
    useModuleSchemasMock.mockReturnValue({
      data: {
        schemas: {
          voting: { type: 'object', title: '투표 설정', properties: {} },
        },
      },
      isLoading: false,
    });

    render(<SettingsSubTab themeId="theme-1" theme={baseTheme} />);

    const forms = screen.getAllByTestId('schema-driven-form');
    expect(forms.length).toBe(1);
  });

  it('여러 모듈의 설정이 각각 표시된다', () => {
    useModuleSchemasMock.mockReturnValue({
      data: {
        schemas: {
          voting: { type: 'object', title: '투표 설정', properties: {} },
          accusation: { type: 'object', title: '고발 설정', properties: {} },
        },
      },
      isLoading: false,
    });

    render(<SettingsSubTab themeId="theme-1" theme={baseTheme} />);

    const forms = screen.getAllByTestId('schema-driven-form');
    expect(forms.length).toBe(2);
  });
});
