import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

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
  useUpdateConfigJson: () => useUpdateConfigJsonMock(),
  useModuleSchemas: () => useModuleSchemasMock(),
}));

vi.mock('@/services/queryClient', () => ({
  queryClient: { invalidateQueries: vi.fn() },
}));

vi.mock('@/features/editor/templateApi', () => ({}));

vi.mock('@/features/editor/components/SchemaDrivenForm', () => ({
  SchemaDrivenForm: ({ schema }: { schema: { title?: string } }) => (
    <div data-testid="schema-driven-form">{schema?.title ?? 'form'}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { ModulesSubTab } from '../ModulesSubTab';
import type { EditorThemeResponse } from '@/features/editor/api';
import { MODULE_CATEGORIES, REQUIRED_MODULE_IDS } from '@/features/editor/constants';

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
  config_json: {},
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
  useModuleSchemasMock.mockReturnValue({ data: null, isLoading: false });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ModulesSubTab', () => {
  it('카테고리 라벨이 렌더링된다', () => {
    render(<ModulesSubTab themeId="theme-1" theme={baseTheme} />);

    for (const category of MODULE_CATEGORIES) {
      expect(screen.getByText(category.label)).toBeDefined();
    }
  });

  it('필수 모듈이 config_json에 포함된 경우 amber dot(비활성화 라벨)으로 표시된다', () => {
    const themeWithRequired: EditorThemeResponse = {
      ...baseTheme,
      config_json: { modules: REQUIRED_MODULE_IDS },
    };
    render(<ModulesSubTab themeId="theme-1" theme={themeWithRequired} />);

    const allModules = MODULE_CATEGORIES.flatMap((c) => c.modules);
    for (const id of REQUIRED_MODULE_IDS) {
      const mod = allModules.find((m) => m.id === id)!;
      const btn = screen.getByLabelText(`${mod.name} 비활성화`);
      expect(btn).toBeDefined();
    }
  });

  it('토글 버튼 클릭 시 mutate가 호출된다', () => {
    const nonRequired = MODULE_CATEGORIES.flatMap((c) => c.modules).find(
      (m) => !m.required,
    )!;

    render(<ModulesSubTab themeId="theme-1" theme={baseTheme} />);

    const toggleBtn = screen.getByLabelText(`${nonRequired.name} 활성화`);
    fireEvent.click(toggleBtn);

    expect(mutateMock).toHaveBeenCalledOnce();
    const [config] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    expect(Array.isArray(config.modules)).toBe(true);
    expect((config.modules as string[]).includes(nonRequired.id)).toBe(true);
  });

  it('활성화된 모듈에 스키마가 있으면 아코디언 펼침 시 SchemaDrivenForm이 렌더링된다', () => {
    const firstMod = MODULE_CATEGORIES[0].modules[0];
    const themeWithMod: EditorThemeResponse = {
      ...baseTheme,
      config_json: { modules: [firstMod.id] },
    };
    useModuleSchemasMock.mockReturnValue({
      data: {
        schemas: {
          [firstMod.id]: { type: 'object', title: '테스트 설정', properties: {} },
        },
      },
      isLoading: false,
    });

    render(<ModulesSubTab themeId="theme-1" theme={themeWithMod} />);

    // Click the chevron/expand button
    const expandBtn = screen.getByLabelText(`${firstMod.name} 설정 펼치기`);
    fireEvent.click(expandBtn);

    expect(screen.getByTestId('schema-driven-form')).toBeDefined();
  });

  it('비활성 모듈은 아코디언 확장 버튼이 없다', () => {
    const nonRequired = MODULE_CATEGORIES.flatMap((c) => c.modules).find(
      (m) => !m.required,
    )!;
    useModuleSchemasMock.mockReturnValue({
      data: {
        schemas: {
          [nonRequired.id]: { type: 'object', title: '설정', properties: {} },
        },
      },
      isLoading: false,
    });

    render(<ModulesSubTab themeId="theme-1" theme={baseTheme} />);

    // Module is disabled — no expand button
    expect(screen.queryByLabelText(`${nonRequired.name} 설정 펼치기`)).toBeNull();
  });
});
