import { isAppearancePreference, type AppearancePreference } from './appearanceResolver';

export const APPEARANCE_STORAGE_KEY = 'mmp.appearance';
export const LEGACY_EDITOR_APPEARANCE_STORAGE_KEY = 'mmp.editor.appearance';

type AppearanceStorage = Pick<Storage, 'getItem' | 'setItem'> & {
  removeItem?: Storage['removeItem'];
};

export function readStoredAppearance(
  storage: AppearanceStorage | null | undefined = getLocalStorage()
): AppearancePreference {
  try {
    const stored = storage?.getItem(APPEARANCE_STORAGE_KEY);
    if (isAppearancePreference(stored)) return stored;

    const legacyStored = storage?.getItem(LEGACY_EDITOR_APPEARANCE_STORAGE_KEY);
    if (isAppearancePreference(legacyStored)) {
      storage?.setItem(APPEARANCE_STORAGE_KEY, legacyStored);
      storage?.removeItem?.(LEGACY_EDITOR_APPEARANCE_STORAGE_KEY);
      return legacyStored;
    }
  } catch {
    return 'system';
  }

  return 'system';
}

export function writeStoredAppearance(
  preference: AppearancePreference,
  storage: AppearanceStorage | null | undefined = getLocalStorage()
): void {
  try {
    storage?.setItem(APPEARANCE_STORAGE_KEY, preference);
    storage?.removeItem?.(LEGACY_EDITOR_APPEARANCE_STORAGE_KEY);
  } catch {
    /* localStorage may be unavailable in private or embedded browsers. */
  }
}

export function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
