import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), '../EditorDashboard.tsx');

describe('EditorDashboard theme tokens', () => {
  it('keeps general screen surfaces on semantic MMP tokens instead of hardcoded slate colors', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('Textarea');
    expect(source).toContain('text-[var(--mmp-color-ink)]');
    expect(source).toContain('text-[var(--mmp-color-steel)]');
    expect(source).toContain('text-[var(--mmp-color-muted)]');

    expect(source).not.toMatch(
      /\b(?:bg|text|border|placeholder:text|focus:border|focus-visible:ring-offset|ring-offset)-slate-(?:50|100|200|300|400|500|600|700|800|900|950)(?:\/\d+)?\b/
    );
  });
});
