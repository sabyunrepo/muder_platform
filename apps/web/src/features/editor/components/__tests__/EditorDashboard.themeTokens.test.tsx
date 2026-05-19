import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const {
  navigateMock,
  useEditorThemesMock,
  useCreateThemeMock,
  useDeleteThemeMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  useEditorThemesMock: vi.fn(),
  useCreateThemeMock: vi.fn(),
  useDeleteThemeMock: vi.fn(),
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/features/editor/api', () => ({
  useEditorThemes: () => useEditorThemesMock(),
  useCreateTheme: () => useCreateThemeMock(),
  useDeleteTheme: () => useDeleteThemeMock(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { EditorDashboard } from '../EditorDashboard';

function renderDashboard() {
  return render(
    <MemoryRouter>
      <EditorDashboard />
    </MemoryRouter>
  );
}

function expectNoFixedSlateClass(element: Element) {
  expect(element.className).not.toMatch(
    /\b(?:bg|text|border|placeholder:text|focus:border|focus-visible:ring-offset|ring-offset)-slate-(?:50|100|200|300|400|500|600|700|800|900|950)(?:\/\d+)?\b/
  );
}

describe('EditorDashboard theme tokens', () => {
  beforeEach(() => {
    useEditorThemesMock.mockReturnValue({
      data: [
        {
          id: 'theme-1',
          title: '명우 비지니스 호텔: 자정의 종소리',
          status: 'PUBLISHED',
          min_players: 5,
          max_players: 5,
          version: 57,
          created_at: '2026-05-12T00:00:00.000Z',
        },
      ],
      isLoading: false,
      isError: false,
    });
    useCreateThemeMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
    useDeleteThemeMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders dashboard headings, cards, and create form controls with semantic token classes', () => {
    renderDashboard();

    const pageTitle = screen.getByRole('heading', { name: '테마 에디터' });
    const pageDescription = screen.getByText('머더미스터리 테마를 만들고 관리하세요');
    const themeTitle = screen.getByRole('heading', {
      name: '명우 비지니스 호텔: 자정의 종소리',
    });
    const themeMeta = screen.getByText('5~5명').closest('div');

    expect(pageTitle.className).toContain('text-[var(--mmp-color-ink)]');
    expect(pageDescription.className).toContain('text-[var(--mmp-color-steel)]');
    expect(themeTitle.className).toContain('text-[var(--mmp-color-ink)]');
    expect(themeMeta?.className).toContain('text-[var(--mmp-color-steel)]');

    fireEvent.click(screen.getByRole('button', { name: '새 테마 만들기' }));

    const descriptionInput = screen.getByRole('textbox', { name: '설명' });
    expect(descriptionInput.tagName).toBe('TEXTAREA');

    for (const element of [pageTitle, pageDescription, themeTitle, themeMeta, descriptionInput]) {
      expect(element).toBeTruthy();
      expectNoFixedSlateClass(element as Element);
    }
  });
});
