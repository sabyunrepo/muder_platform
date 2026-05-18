import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppearanceProvider } from '@/shared/appearance';
import { ThemeModeToggle } from '../index';

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

describe('ThemeModeToggle', () => {
  it('changes project appearance preference', () => {
    render(
      <AppearanceProvider>
        <ThemeModeToggle />
      </AppearanceProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /다크/ }));

    expect(document.documentElement.dataset.themePreference).toBe('dark');
    expect(screen.getByRole('button', { name: /다크/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('supports compact icon-only usage with a custom group label', () => {
    render(
      <AppearanceProvider>
        <ThemeModeToggle compact ariaLabel="에디터 화면 모드" />
      </AppearanceProvider>,
    );

    expect(screen.getByRole('group', { name: '에디터 화면 모드' })).toBeDefined();
    expect(screen.queryByText('시스템')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '라이트' }));

    expect(document.documentElement.dataset.themePreference).toBe('light');
    expect(screen.getByRole('button', { name: '라이트' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
});
