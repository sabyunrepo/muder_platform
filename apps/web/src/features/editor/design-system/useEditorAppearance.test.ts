import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EDITOR_APPEARANCE_STORAGE_KEY,
  type EditorAppearancePreference,
  readStoredEditorAppearance,
  resolveEditorAppearancePreference,
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

  it('잘못 저장된 값은 무시한다', () => {
    window.localStorage.setItem(EDITOR_APPEARANCE_STORAGE_KEY, 'sepia');

    expect(readStoredEditorAppearance()).toBe('system');
  });

  it.each(['system', 'light', 'dark'] as const)(
    '사용자가 %s appearance 값을 선택하면 저장하고 즉시 반영한다',
    (mode: EditorAppearancePreference) => {
      const { result } = renderHook(() => useEditorAppearance());

      act(() => result.current.setPreference(mode));

      expect(result.current.preference).toBe(mode);
      expect(result.current.resolvedTheme).toBe(mode === 'dark' ? 'dark' : 'light');
      expect(window.localStorage.getItem(EDITOR_APPEARANCE_STORAGE_KEY)).toBe(mode);
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
});

describe('editor appearance helpers', () => {
  it('preference와 시스템 dark 여부로 실제 테마를 해석한다', () => {
    expect(resolveEditorAppearancePreference('system', false)).toBe('light');
    expect(resolveEditorAppearancePreference('system', true)).toBe('dark');
    expect(resolveEditorAppearancePreference('light', true)).toBe('light');
    expect(resolveEditorAppearancePreference('dark', false)).toBe('dark');
  });

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
