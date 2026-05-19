import type { ReactElement } from 'react';
import { cleanup, render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import type { MemoryRouterProps } from 'react-router';
import { AppearanceProvider } from '@/shared/appearance';

export function setupAppearanceTestEnv() {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => storage.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
        removeItem: vi.fn((key: string) => storage.delete(key)),
        clear: vi.fn(() => storage.clear()),
      },
    });
  });

  afterEach(() => {
    cleanup();
    storage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-preference');
    document.documentElement.style.colorScheme = '';
  });

  return { storage };
}

type RenderWithAppearanceRouterOptions = RenderOptions & {
  router?: Pick<MemoryRouterProps, 'initialEntries' | 'initialIndex'>;
};

export function renderWithAppearanceRouter(
  ui: ReactElement,
  options: RenderWithAppearanceRouterOptions = {}
) {
  const { router, ...renderOptions } = options;

  return render(
    <AppearanceProvider>
      <MemoryRouter {...router}>{ui}</MemoryRouter>
    </AppearanceProvider>,
    renderOptions
  );
}
