import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppearanceProvider } from '@/shared/appearance';
import { PublicThemeShell } from '@/shared/components/PublicThemeShell';

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

function renderShell() {
  return render(
    <AppearanceProvider>
      <MemoryRouter>
        <PublicThemeShell>
          <h1>공개 페이지</h1>
        </PublicThemeShell>
      </MemoryRouter>
    </AppearanceProvider>
  );
}

describe('PublicThemeShell', () => {
  it('renders global theme controls for unauthenticated surfaces', () => {
    renderShell();

    expect(screen.getByRole('link', { name: 'MMP' }).getAttribute('href')).toBe('/');
    expect(screen.getByText('공개 페이지')).toBeDefined();
    expect(screen.getAllByRole('button', { name: '시스템' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '라이트' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '다크' }).length).toBeGreaterThan(0);
  });

  it('writes the selected theme preference to the document root', () => {
    renderShell();

    fireEvent.click(screen.getAllByRole('button', { name: '다크' })[0]);
    expect(document.documentElement.dataset.themePreference).toBe('dark');

    fireEvent.click(screen.getAllByRole('button', { name: '시스템' })[0]);
    expect(document.documentElement.dataset.themePreference).toBe('system');
  });
});
