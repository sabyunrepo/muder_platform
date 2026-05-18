import { SYSTEM_DARK_QUERY, type ResolvedTheme } from './appearanceResolver';

export type SystemAppearanceListener = (resolvedTheme: ResolvedTheme) => void;

type SystemColorSchemeChangeTarget = {
  matches: boolean;
  addEventListener?: (event: 'change', listener: (event: { matches: boolean }) => void) => void;
  removeEventListener?: (event: 'change', listener: (event: { matches: boolean }) => void) => void;
  addListener?: (listener: (event: { matches: boolean }) => void) => void;
  removeListener?: (listener: (event: { matches: boolean }) => void) => void;
};

export type MatchSystemColorScheme = (query: string) => SystemColorSchemeChangeTarget;

export function readSystemPrefersDark(
  matchSystemColorScheme: MatchSystemColorScheme | null | undefined = getMatchMedia()
): boolean {
  if (!matchSystemColorScheme) return false;
  return matchSystemColorScheme(SYSTEM_DARK_QUERY).matches;
}

export function subscribeToSystemAppearance(
  listener: SystemAppearanceListener,
  matchSystemColorScheme: MatchSystemColorScheme | null | undefined = getMatchMedia()
): () => void {
  if (!matchSystemColorScheme) return () => {};

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

function getMatchMedia(): MatchSystemColorScheme | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  return window.matchMedia.bind(window);
}
