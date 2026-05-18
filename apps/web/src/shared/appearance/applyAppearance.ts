import type { AppearancePreference, ResolvedTheme } from './appearanceResolver';

export function applyAppearanceToDocument(
  documentRef: Pick<Document, 'documentElement'> | null | undefined,
  preference: AppearancePreference,
  resolvedTheme: ResolvedTheme
): void {
  const root = documentRef?.documentElement;
  if (!root) return;

  root.dataset.theme = resolvedTheme;
  root.dataset.themePreference = preference;
  root.style.colorScheme = resolvedTheme;
}
