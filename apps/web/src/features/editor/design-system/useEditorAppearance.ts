import { useCallback, useEffect, useMemo, useState } from 'react';

export const EDITOR_APPEARANCE_STORAGE_KEY = 'mmp.editor.appearance';

export type EditorAppearancePreference = 'system' | 'light' | 'dark';
export type EditorResolvedAppearance = 'light' | 'dark';

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

export function isEditorAppearancePreference(value: unknown): value is EditorAppearancePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function resolveEditorAppearancePreference(
  preference: EditorAppearancePreference,
  prefersDark: boolean
): EditorResolvedAppearance {
  if (preference === 'system') {
    return prefersDark ? 'dark' : 'light';
  }
  return preference;
}

export function readStoredEditorAppearance(
  storage: Pick<Storage, 'getItem'> | null | undefined = getLocalStorage()
): EditorAppearancePreference {
  try {
    const stored = storage?.getItem(EDITOR_APPEARANCE_STORAGE_KEY);
    return isEditorAppearancePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function writeStoredEditorAppearance(
  preference: EditorAppearancePreference,
  storage: Pick<Storage, 'setItem'> | null | undefined = getLocalStorage()
): void {
  try {
    storage?.setItem(EDITOR_APPEARANCE_STORAGE_KEY, preference);
  } catch {
    /* localStorage may be unavailable in private or embedded browsers. */
  }
}

export function useEditorAppearance() {
  const [preference, setPreferenceState] = useState<EditorAppearancePreference>(() =>
    readStoredEditorAppearance()
  );
  const [prefersDark, setPrefersDark] = useState(readSystemPrefersDark);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const query = window.matchMedia(SYSTEM_DARK_QUERY);
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setPrefersDark(event.matches);
    };

    handleChange(query);

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', handleChange);
      return () => query.removeEventListener('change', handleChange);
    }

    query.addListener(handleChange);
    return () => query.removeListener(handleChange);
  }, []);

  const setPreference = useCallback((nextPreference: EditorAppearancePreference) => {
    writeStoredEditorAppearance(nextPreference);
    setPreferenceState(nextPreference);
  }, []);

  const resolvedTheme = useMemo(
    () => resolveEditorAppearancePreference(preference, prefersDark),
    [preference, prefersDark]
  );

  return {
    preference,
    resolvedTheme,
    setPreference,
  };
}

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(SYSTEM_DARK_QUERY).matches;
}
