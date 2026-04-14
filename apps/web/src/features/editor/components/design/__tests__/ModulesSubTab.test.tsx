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
import {
  MODULE_CATEGORIES,
  OPTIONAL_MODULE_CATEGORIES,
  REQUIRED_MODULE_IDS,
} from '@/features/editor/constants';

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
  it('코어 모듈(required)이 렌더링되지 않는다', () => {
    render(<ModulesSubTab themeId="theme-1" theme={baseTheme} />);

    const coreModules = MODULE_CATEGORIES.find((c) => c.key === 'core')!.modules;
    for (const mod of coreModules) {
      expect(screen.queryByText(mod.name)).toBeNull();
    }
  });

  it('optional 카테고리 라벨이 렌더링된다', () => {
    render(<ModulesSubTab themeId="theme-1" theme={baseTheme} />);

    for (const category of OPTIONAL_MODULE_CATEGORIES) {
      expect(screen.getByText(category.label)).toBeDefined();
    }
  });

  it('코어 카테고리(코어)는 렌더링되지 않는다', () => {
    render(<ModulesSubTab themeId="theme-1" theme={baseTheme} />);

    // "코어" label should not appear since all its modules are required
    expect(screen.queryByText('코어')).toBeNull();
  });

  it('토글 버튼 클릭 시 mutate가 호출된다', () => {
    const optionalMod = OPTIONAL_MODULE_CATEGORIES[0].modules[0];

    render(<ModulesSubTab themeId="theme-1" theme={baseTheme} />);

    const toggleBtn = screen.getByRole('switch', { name: `${optionalMod.name} 활성화` });
    fireEvent.click(toggleBtn);

    expect(mutateMock).toHaveBeenCalledOnce();
    const [config] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    expect(Array.isArray(config.modules)).toBe(true);
    expect((config.modules as string[]).includes(optionalMod.id)).toBe(true);
  });

  it('활성화된 모듈 토글 클릭 시 목록에서 제거된다', () => {
    const optionalMod = OPTIONAL_MODULE_CATEGORIES[0].modules[0];
    const themeWithMod: EditorThemeResponse = {
      ...baseTheme,
      config_json: { modules: [optionalMod.id] },
    };

    render(<ModulesSubTab themeId="theme-1" theme={themeWithMod} />);

    const toggleBtn = screen.getByRole('switch', { name: `${optionalMod.name} 비활성화` });
    fireEvent.click(toggleBtn);

    expect(mutateMock).toHaveBeenCalledOnce();
    const [config] = mutateMock.mock.calls[0] as [Record<string, unknown>];
    expect((config.modules as string[]).includes(optionalMod.id)).toBe(false);
  });

  it('활성화 + 스키마 있으면 SchemaDrivenForm이 바로 렌더링된다', () => {
    const optionalMod = OPTIONAL_MODULE_CATEGORIES[0].modules[0];
    const themeWithMod: EditorThemeResponse = {
      ...baseTheme,
      config_json: { modules: [optionalMod.id] },
    };
    useModuleSchemasMock.mockReturnValue({
      data: {
        schemas: {
          [optionalMod.id]: { type: 'object', title: '테스트 설정', properties: {} },
        },
      },
      isLoading: false,
    });

    render(<ModulesSubTab themeId="theme-1" theme={themeWithMod} />);

    // No click needed — inline display
    expect(screen.getByTestId('schema-driven-form')).toBeDefined();
    expect(screen.getByText('테스트 설정')).toBeDefined();
  });

  it('비활성 모듈은 스키마가 있어도 SchemaDrivenForm이 렌더링되지 않는다', () => {
    const optionalMod = OPTIONAL_MODULE_CATEGORIES[0].modules[0];
    useModuleSchemasMock.mockReturnValue({
      data: {
        schemas: {
          [optionalMod.id]: { type: 'object', title: '설정', properties: {} },
        },
      },
      isLoading: false,
    });

    render(<ModulesSubTab themeId="theme-1" theme={baseTheme} />);

    expect(screen.queryByTestId('schema-driven-form')).toBeNull();
  });

  it('REQUIRED_MODULE_IDS의 모듈은 toggle 버튼이 없다', () => {
    render(<ModulesSubTab themeId="theme-1" theme={baseTheme} />);

    const allModules = MODULE_CATEGORIES.flatMap((c) => c.modules);
    for (const id of REQUIRED_MODULE_IDS) {
      const mod = allModules.find((m) => m.id === id)!;
      expect(screen.queryByRole('switch', { name: `${mod.name} 활성화` })).toBeNull();
      expect(screen.queryByRole('switch', { name: `${mod.name} 비활성화` })).toBeNull();
    }
  });
});
