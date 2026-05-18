import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APPEARANCE_STORAGE_KEY } from '@/shared/appearance';
import {
  EDITOR_APPEARANCE_STORAGE_KEY,
  type EditorAppearancePreference,
  readStoredEditorAppearance,
  resolveEditorAppearancePreference,
  subscribeToSystemEditorAppearance,
  useEditorAppearance,
  writeStoredEditorAppearance,
} from './useEditorAppearance';

type MediaListener = (event: { matches: boolean }) => void;

let mediaMatches = false;
let mediaListeners: MediaListener[] = [];
let storageItems: Record<string, string> = {};

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
  vi.unstubAllGlobals();
});

describe('useEditorAppearance', () => {
  it('저장값이 없으면 시스템 설정을 기본값으로 사용한다', () => {
    const { result } = renderHook(() => useEditorAppearance());

    expect(result.current.preference).toBe('system');
    expect(result.current.resolvedTheme).toBe('light');
  });

  it.each([
    ['system', true, 'dark'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
  ] as const)(
    '저장된 %s appearance 값을 첫 렌더에서 복원한다',
    (storedPreference, systemPrefersDark, expectedResolvedTheme) => {
      mediaMatches = systemPrefersDark;
      window.localStorage.setItem(EDITOR_APPEARANCE_STORAGE_KEY, storedPreference);

      const { result } = renderHook(() => useEditorAppearance());

      expect(result.current.preference).toBe(storedPreference);
      expect(result.current.resolvedTheme).toBe(expectedResolvedTheme);
    }
  );

  it('시스템 모드는 첫 렌더부터 운영체제 dark 설정을 반영한다', () => {
    mediaMatches = true;

    const { result } = renderHook(() => useEditorAppearance());

    expect(result.current.preference).toBe('system');
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it.each([
    ['empty string', ''],
    ['unsupported mode', 'sepia'],
  ])('저장된 appearance 값이 %s이면 기본 시스템 설정으로 되돌린다', (_label, storedValue) => {
    window.localStorage.setItem(EDITOR_APPEARANCE_STORAGE_KEY, storedValue);

    expect(readStoredEditorAppearance()).toBe('system');
  });

  it.each(['system', 'light', 'dark'] as const)(
    '사용자가 %s appearance 값을 선택하면 저장하고 즉시 반영한다',
    (mode: EditorAppearancePreference) => {
      const { result } = renderHook(() => useEditorAppearance());

      act(() => result.current.setPreference(mode));

      expect(result.current.preference).toBe(mode);
      expect(result.current.resolvedTheme).toBe(mode === 'dark' ? 'dark' : 'light');
      expect(window.localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe(mode);
      expect(window.localStorage.getItem(EDITOR_APPEARANCE_STORAGE_KEY)).toBeNull();
    }
  );

  it('시스템 모드는 운영체제 색상 변경을 따라간다', () => {
    const { result } = renderHook(() => useEditorAppearance());

    act(() => {
      mediaMatches = true;
      mediaListeners.forEach((listener) => listener({ matches: true }));
    });

    expect(result.current.preference).toBe('system');
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it.each([
    ['light', false, true],
    ['dark', true, false],
  ] as const)(
    '%s 모드는 운영체제 색상 변경 이벤트를 무시하고 선택한 테마를 유지한다',
    (mode, initialSystemPrefersDark, nextSystemPrefersDark) => {
      mediaMatches = initialSystemPrefersDark;
      const { result } = renderHook(() => useEditorAppearance());

      act(() => result.current.setPreference(mode));

      expect(result.current.preference).toBe(mode);
      expect(result.current.resolvedTheme).toBe(mode);

      act(() => {
        mediaMatches = nextSystemPrefersDark;
        mediaListeners.forEach((listener) => listener({ matches: nextSystemPrefersDark }));
      });

      expect(result.current.preference).toBe(mode);
      expect(result.current.resolvedTheme).toBe(mode);
    }
  );
});

describe('editor appearance helpers', () => {
  it('시스템 색상 변경 이벤트를 실제 light/dark 값으로 변환해 전달한다', () => {
    const listeners: MediaListener[] = [];
    const removeEventListener = vi.fn((_event: 'change', listener: MediaListener) => {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    });
    const matchMedia = vi.fn((media: string) => ({
      matches: false,
      media,
      addEventListener: vi.fn((_event: 'change', listener: MediaListener) => {
        listeners.push(listener);
      }),
      removeEventListener,
    }));
    const onResolvedThemeChange = vi.fn();

    const unsubscribe = subscribeToSystemEditorAppearance(onResolvedThemeChange, matchMedia);

    listeners.forEach((listener) => listener({ matches: true }));
    listeners.forEach((listener) => listener({ matches: false }));
    unsubscribe();

    expect(onResolvedThemeChange).toHaveBeenNthCalledWith(1, 'dark');
    expect(onResolvedThemeChange).toHaveBeenNthCalledWith(2, 'light');
    expect(removeEventListener).toHaveBeenCalledTimes(1);
    expect(listeners).toHaveLength(0);
  });

  it.each([
    ['system', false, 'light'],
    ['system', true, 'dark'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
  ] as const)(
    '%s preference와 system dark=%s 입력을 %s resolved theme으로 해석한다',
    (preference, prefersDark, expectedResolvedTheme) => {
      expect(resolveEditorAppearancePreference(preference, prefersDark)).toBe(
        expectedResolvedTheme
      );
    }
  );

  it('storage 접근이 실패해도 기본값으로 동작한다', () => {
    const blockedStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };

    expect(readStoredEditorAppearance(blockedStorage)).toBe('system');
    expect(() => writeStoredEditorAppearance('dark', blockedStorage)).not.toThrow();
  });
});
