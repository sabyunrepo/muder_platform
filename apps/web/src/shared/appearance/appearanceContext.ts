import { createContext } from 'react';
import type { AppearancePreference, ResolvedTheme } from './appearanceResolver';

export interface AppearanceContextValue {
  preference: AppearancePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: AppearancePreference) => void;
}

export const AppearanceContext = createContext<AppearanceContextValue | null>(null);
