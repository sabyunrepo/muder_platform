import { describe, expect, it, vi } from 'vitest';
import {
  APPEARANCE_STORAGE_KEY,
  LEGACY_EDITOR_APPEARANCE_STORAGE_KEY,
  readStoredAppearance,
  writeStoredAppearance,
} from './appearanceStorage';

function createStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
  };
}

describe('appearanceStorage', () => {
  it('prefers the project-wide appearance key over the legacy editor key', () => {
    const storage = createStorage({
      [APPEARANCE_STORAGE_KEY]: 'light',
      [LEGACY_EDITOR_APPEARANCE_STORAGE_KEY]: 'dark',
    });

    expect(readStoredAppearance(storage)).toBe('light');
  });

  it('migrates the legacy editor appearance key to the project-wide key', () => {
    const storage = createStorage({
      [LEGACY_EDITOR_APPEARANCE_STORAGE_KEY]: 'dark',
    });

    expect(readStoredAppearance(storage)).toBe('dark');
    expect(storage.setItem).toHaveBeenCalledWith(APPEARANCE_STORAGE_KEY, 'dark');
    expect(storage.removeItem).toHaveBeenCalledWith(LEGACY_EDITOR_APPEARANCE_STORAGE_KEY);
  });

  it('returns system for unsupported values', () => {
    const storage = createStorage({
      [APPEARANCE_STORAGE_KEY]: 'sepia',
      [LEGACY_EDITOR_APPEARANCE_STORAGE_KEY]: 'auto',
    });

    expect(readStoredAppearance(storage)).toBe('system');
  });

  it('writes the project-wide key and clears the legacy editor key', () => {
    const storage = createStorage({
      [LEGACY_EDITOR_APPEARANCE_STORAGE_KEY]: 'dark',
    });

    writeStoredAppearance('light', storage);

    expect(storage.setItem).toHaveBeenCalledWith(APPEARANCE_STORAGE_KEY, 'light');
    expect(storage.removeItem).toHaveBeenCalledWith(LEGACY_EDITOR_APPEARANCE_STORAGE_KEY);
  });

  it('does not throw when storage access fails', () => {
    const blockedStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };

    expect(readStoredAppearance(blockedStorage)).toBe('system');
    expect(() => writeStoredAppearance('dark', blockedStorage)).not.toThrow();
  });
});
