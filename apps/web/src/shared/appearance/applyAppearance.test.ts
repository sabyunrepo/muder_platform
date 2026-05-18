import { describe, expect, it } from 'vitest';
import { applyAppearanceToDocument } from './applyAppearance';

describe('applyAppearanceToDocument', () => {
  it('writes resolved theme and preference to the document root', () => {
    const documentRef = document.implementation.createHTMLDocument('appearance');

    applyAppearanceToDocument(documentRef, 'system', 'dark');

    expect(documentRef.documentElement.dataset.theme).toBe('dark');
    expect(documentRef.documentElement.dataset.themePreference).toBe('system');
    expect(documentRef.documentElement.style.colorScheme).toBe('dark');
  });
});
