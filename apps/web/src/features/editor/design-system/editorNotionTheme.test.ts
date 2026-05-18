import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const cssPath = join(dirname(fileURLToPath(import.meta.url)), 'editorNotionTheme.css');

describe('editorNotionTheme legacy bridge', () => {
  it('keeps legacy utility overrides scoped to the editor boundary', () => {
    const css = readFileSync(cssPath, 'utf8');

    expect(css).toContain('.mmp-editor-design-scope .bg-slate-900');
    expect(css).toContain('.mmp-editor-design-scope .text-slate-100');
    expect(css).toContain('.mmp-editor-design-scope .border-slate-700');
    expect(css).toContain('var(--mmp-editor-color-canvas)');
    expect(css).not.toMatch(/(^|\n)\.bg-slate-900[,\s{]/);
  });

  it('maps legacy amber actions to the editor primary token', () => {
    const css = readFileSync(cssPath, 'utf8');

    expect(css).toContain('.mmp-editor-design-scope .bg-amber-500');
    expect(css).toContain('var(--mmp-editor-color-primary)');
    expect(css).toContain('var(--mmp-editor-color-on-primary)');
  });

  it('aliases editor colors to project-wide semantic tokens', () => {
    const css = readFileSync(cssPath, 'utf8');

    expect(css).toContain('--mmp-editor-color-primary: var(--mmp-color-primary)');
    expect(css).toContain('--mmp-editor-color-canvas: var(--mmp-color-canvas)');
    expect(css).toContain('--mmp-editor-color-surface-soft: var(--mmp-color-surface-soft)');
    expect(css).toContain('--mmp-editor-color-tag-bg: var(--mmp-color-tag-bg)');
    expect(css).not.toContain('--mmp-editor-color-primary: #5645d4');
    expect(css).not.toContain('--mmp-editor-color-primary: #a99cff');
  });

  it('keeps dark mode scope guards inside the editor boundary', () => {
    const css = readFileSync(cssPath, 'utf8');

    expect(css).toContain(".mmp-editor-design-scope[data-editor-theme='dark']");
    expect(css).toContain('--mmp-editor-shadow-card');
    expect(css).toContain('color-scheme: dark');
    expect(css).not.toMatch(/(^|\n)\[data-editor-theme='dark'\][,\s{]/);
  });
});
