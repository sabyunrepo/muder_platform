import { describe, expect, it } from 'vitest';

import {
  isAppearancePreference,
  resolveAppearancePreference,
  type AppearancePreference,
  type ResolvedTheme,
} from './appearanceResolver';

describe('appearanceResolver', () => {
  it.each([
    ['system', false, 'light'],
    ['system', true, 'dark'],
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
  ] as const)(
    '%s preference with OS dark=%s resolves to %s',
    (
      preference: AppearancePreference,
      systemPrefersDark: boolean,
      expectedTheme: ResolvedTheme
    ) => {
      expect(resolveAppearancePreference(preference, systemPrefersDark)).toBe(expectedTheme);
    }
  );

  it.each(['system', 'light', 'dark'] as const)(
    'accepts %s as a stable appearance preference',
    (preference) => {
      expect(isAppearancePreference(preference)).toBe(true);
    }
  );

  it.each([undefined, null, '', 'sepia', 'auto', 'LIGHT'])(
    'rejects unsupported appearance preference value %s',
    (preference) => {
      expect(isAppearancePreference(preference)).toBe(false);
    }
  );
});
