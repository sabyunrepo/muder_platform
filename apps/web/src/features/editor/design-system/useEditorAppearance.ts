import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  readStoredAppearance,
  readSystemPrefersDark,
  isAppearancePreference,
  resolveAppearancePreference,
  subscribeToSystemAppearance,
  type AppearancePreference,
  type ResolvedTheme,
  writeStoredAppearance,
} from '@/shared/appearance';

export const EDITOR_APPEARANCE_STORAGE_KEY = 'mmp.editor.appearance';

export type EditorAppearancePreference = AppearancePreference;
export type EditorResolvedAppearance = ResolvedTheme;
export type EditorSystemAppearanceListener = (resolvedTheme: EditorResolvedAppearance) => void;

type SystemColorSchemeChangeTarget = {
  matches: boolean;
  addEventListener?: (event: 'change', listener: (event: { matches: boolean }) => void) => void;
  removeEventListener?: (event: 'change', listener: (event: { matches: boolean }) => void) => void;
  addListener?: (listener: (event: { matches: boolean }) => void) => void;
  removeListener?: (listener: (event: { matches: boolean }) => void) => void;
};

type MatchSystemColorScheme = (query: string) => SystemColorSchemeChangeTarget;

export function isEditorAppearancePreference(value: unknown): value is EditorAppearancePreference {
  return isAppearancePreference(value);
}

export function resolveEditorAppearancePreference(
  preference: EditorAppearancePreference,
  prefersDark: boolean
): EditorResolvedAppearance {
  return resolveAppearancePreference(preference, prefersDark);
}

export function readStoredEditorAppearance(
  storage:
    | (Pick<Storage, 'getItem' | 'setItem'> & { removeItem?: Storage['removeItem'] })
    | null
    | undefined = getLocalStorage()
): EditorAppearancePreference {
  return readStoredAppearance(storage);
}

export function writeStoredEditorAppearance(
  preference: EditorAppearancePreference,
  storage:
    | (Pick<Storage, 'getItem' | 'setItem'> & { removeItem?: Storage['removeItem'] })
    | null
    | undefined = getLocalStorage()
): void {
  writeStoredAppearance(preference, storage);
}

export function subscribeToSystemEditorAppearance(
  listener: EditorSystemAppearanceListener,
  matchSystemColorScheme: MatchSystemColorScheme | null | undefined = getMatchMedia()
): () => void {
  return subscribeToSystemAppearance(listener, matchSystemColorScheme);
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
