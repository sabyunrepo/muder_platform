import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { resolveAppearancePreference, type AppearancePreference } from './appearanceResolver';
import { applyAppearanceToDocument } from './applyAppearance';
import { AppearanceContext } from './appearanceContext';
import { readStoredAppearance, writeStoredAppearance } from './appearanceStorage';
import { readSystemPrefersDark, subscribeToSystemAppearance } from './systemAppearance';

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<AppearancePreference>(() =>
    readStoredAppearance()
  );
  const [prefersDark, setPrefersDark] = useState(readSystemPrefersDark);

  useEffect(() => {
    return subscribeToSystemAppearance((nextResolvedTheme) => {
      setPrefersDark(nextResolvedTheme === 'dark');
    });
  }, []);

  const resolvedTheme = resolveAppearancePreference(preference, prefersDark);

  useEffect(() => {
    applyAppearanceToDocument(document, preference, resolvedTheme);
  }, [preference, resolvedTheme]);

  const setPreference = useCallback((nextPreference: AppearancePreference) => {
    writeStoredAppearance(nextPreference);
    setPreferenceState(nextPreference);
  }, []);

  const value = useMemo(
    () => ({
      preference,
      resolvedTheme,
      setPreference,
    }),
    [preference, resolvedTheme, setPreference]
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}
