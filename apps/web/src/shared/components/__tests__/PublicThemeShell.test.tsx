import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { PublicThemeShell } from '@/shared/components/PublicThemeShell';
import { renderWithAppearanceRouter, setupAppearanceTestEnv } from '@/shared/test-utils/appearance';

setupAppearanceTestEnv();

function renderShell() {
  return renderWithAppearanceRouter(
    <PublicThemeShell>
      <h1>공개 페이지</h1>
    </PublicThemeShell>
  );
}

describe('PublicThemeShell', () => {
  it('renders global theme controls for unauthenticated surfaces', () => {
    renderShell();

    expect(screen.getByRole('link', { name: 'MMP' }).getAttribute('href')).toBe('/');
    expect(screen.getByText('공개 페이지')).toBeDefined();
    expect(screen.getAllByRole('button', { name: '시스템' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '라이트' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '다크' }).length).toBeGreaterThan(0);
  });

  it('writes the selected theme preference to the document root', () => {
    renderShell();

    fireEvent.click(screen.getAllByRole('button', { name: '다크' })[0]);
    expect(document.documentElement.dataset.themePreference).toBe('dark');

    fireEvent.click(screen.getAllByRole('button', { name: '시스템' })[0]);
    expect(document.documentElement.dataset.themePreference).toBe('system');
  });
});
