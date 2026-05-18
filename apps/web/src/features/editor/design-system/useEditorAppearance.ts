import { useCallback, useEffect, useMemo, useState } from 'react';

export const EDITOR_APPEARANCE_STORAGE_KEY = 'mmp.editor.appearance';

export type EditorAppearancePreference = 'system' | 'light' | 'dark';
export type EditorResolvedAppearance = 'light' | 'dark';
export type EditorSystemAppearanceListener = (resolvedTheme: EditorResolvedAppearance) => void;

type SystemColorSchemeChangeTarget = {
  matches: boolean;
  addEventListener?: (
    event: 'change',
    listener: (event: { matches: boolean }) => void
  ) => void;
  removeEventListener?: (
    event: 'change',
    listener: (event: { matches: boolean }) => void
  ) => void;
  addListener?: (listener: (event: { matches: boolean }) => void) => void;
  removeListener?: (listener: (event: { matches: boolean }) => void) => void;
};

type MatchSystemColorScheme = (query: string) => SystemColorSchemeChangeTarget;

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

export function subscribeToSystemEditorAppearance(
  listener: EditorSystemAppearanceListener,
  matchSystemColorScheme: MatchSystemColorScheme | null | undefined = getMatchMedia()
): () => void {
  if (!matchSystemColorScheme) {
    return () => {};
  }

  const query = matchSystemColorScheme(SYSTEM_DARK_QUERY);
  const handleChange = (event: { matches: boolean }) => {
    listener(event.matches ? 'dark' : 'light');
  };

  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener?.('change', handleChange);
  }

  query.addListener?.(handleChange);
  return () => query.removeListener?.(handleChange);
}

export function useEditorAppearance() {
  const [preference, setPreferenceState] = useState<EditorAppearancePreference>(() =>
    readStoredEditorAppearance()
  );
  const [prefersDark, setPrefersDark] = useState(readSystemPrefersDark);

  useEffect(() => {
    return subscribeToSystemEditorAppearance((nextResolvedTheme) => {
      setPrefersDark(nextResolvedTheme === 'dark');
    });
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

function getMatchMedia(): MatchSystemColorScheme | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  return window.matchMedia.bind(window);
}

function readSystemPrefersDark(): boolean {
  const matchMedia = getMatchMedia();
  if (!matchMedia) {
    return false;
  }
  return matchMedia(SYSTEM_DARK_QUERY).matches;
}
