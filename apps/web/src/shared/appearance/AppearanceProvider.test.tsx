import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppearanceProvider } from './AppearanceProvider';
import { APPEARANCE_STORAGE_KEY } from './appearanceStorage';
import { useAppearance } from './useAppearance';

type MediaListener = (event: { matches: boolean }) => void;

let mediaMatches = false;
let mediaListeners: MediaListener[] = [];
let storageItems: Record<string, string> = {};

function TestConsumer() {
  const { preference, resolvedTheme, setPreference } = useAppearance();
  return (
    <div>
      <p>
        {preference}:{resolvedTheme}
      </p>
      <button type="button" onClick={() => setPreference('dark')}>
        dark
      </button>
    </div>
  );
}

beforeEach(() => {
  mediaMatches = false;
  mediaListeners = [];
  storageItems = {};
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: vi.fn((key: string) => storageItems[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storageItems[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete storageItems[key];
      }),
      clear: vi.fn(() => {
        storageItems = {};
      }),
    },
  });
  window.localStorage.clear();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((media: string) => ({
      matches: mediaMatches,
      media,
      onchange: null,
      addEventListener: vi.fn((_event: 'change', listener: MediaListener) => {
        mediaListeners.push(listener);
      }),
      removeEventListener: vi.fn((_event: 'change', listener: MediaListener) => {
        mediaListeners = mediaListeners.filter((candidate) => candidate !== listener);
      }),
      addListener: vi.fn((listener: MediaListener) => {
        mediaListeners.push(listener);
      }),
      removeListener: vi.fn((listener: MediaListener) => {
        mediaListeners = mediaListeners.filter((candidate) => candidate !== listener);
      }),
      dispatchEvent: vi.fn(),
    }))
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-theme-preference');
  document.documentElement.style.colorScheme = '';
  window.localStorage.clear();
});

describe('AppearanceProvider', () => {
  it('uses system preference by default and applies it to the document root', () => {
    render(
      <AppearanceProvider>
        <TestConsumer />
      </AppearanceProvider>
    );

    expect(screen.getByText('system:light')).toBeDefined();
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.themePreference).toBe('system');
  });

  it('updates document theme when system mode follows OS changes', () => {
    render(
      <AppearanceProvider>
        <TestConsumer />
      </AppearanceProvider>
    );

    act(() => {
      mediaMatches = true;
      mediaListeners.forEach((listener) => listener({ matches: true }));
    });

    expect(screen.getByText('system:dark')).toBeDefined();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('stores explicit user preference and keeps it independent from OS changes', () => {
    render(
      <AppearanceProvider>
        <TestConsumer />
      </AppearanceProvider>
    );

    act(() => {
      screen.getByRole('button', { name: 'dark' }).click();
    });

    expect(screen.getByText('dark:dark')).toBeDefined();
    expect(window.localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('dark');

    act(() => {
      mediaMatches = false;
      mediaListeners.forEach((listener) => listener({ matches: false }));
    });

    expect(screen.getByText('dark:dark')).toBeDefined();
  });
});
