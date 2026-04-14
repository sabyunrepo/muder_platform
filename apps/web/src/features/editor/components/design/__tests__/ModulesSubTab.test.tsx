import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mutateMock, useUpdateConfigJsonMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  useUpdateConfigJsonMock: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/features/editor/api', () => ({
  useUpdateConfigJson: () => useUpdateConfigJsonMock(),
}));

vi.mock('@/services/queryClient', () => ({
  queryClient: { invalidateQueries: vi.fn() },
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
      // When enabled the aria-label says "비활성화" (click to deactivate)
      const btn = screen.getByLabelText(`${mod.name} 비활성화`);
      expect(btn).toBeDefined();
    }
  });

  it('모듈 이름 클릭 시 상세 패널이 표시된다', () => {
    const firstMod = MODULE_CATEGORIES[0].modules[0];
    render(<ModulesSubTab themeId="theme-1" theme={baseTheme} />);

    fireEvent.click(screen.getByText(firstMod.name));

    // Detail panel shows the module name as heading and description
    expect(screen.getAllByText(firstMod.name).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(firstMod.description)).toBeDefined();
  });

  it('토글 버튼 클릭 시 mutate가 호출된다', () => {
    // Use a non-required module so toggle is meaningful
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

  it('모듈 미선택 상태에서 "좌측에서 모듈을 선택하세요" 메시지가 표시된다', () => {
    render(<ModulesSubTab themeId="theme-1" theme={baseTheme} />);
    expect(screen.getByText('좌측에서 모듈을 선택하세요')).toBeDefined();
  });
});
