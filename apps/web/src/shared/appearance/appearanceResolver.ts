export const APPEARANCE_PREFERENCES = ['system', 'light', 'dark'] as const;
export const RESOLVED_THEMES = ['light', 'dark'] as const;
export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

export type AppearancePreference = (typeof APPEARANCE_PREFERENCES)[number];
export type ResolvedTheme = (typeof RESOLVED_THEMES)[number];

export function isAppearancePreference(value: unknown): value is AppearancePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function resolveAppearancePreference(
  preference: AppearancePreference,
  systemPrefersDark: boolean
): ResolvedTheme {
  if (preference === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }
  return preference;
}
