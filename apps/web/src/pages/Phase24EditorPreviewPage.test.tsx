import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Phase24EditorPreviewPage from './Phase24EditorPreviewPage';

function renderPreview() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Phase24EditorPreviewPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe('Phase24EditorPreviewPage', () => {
  it('Phase 24 entity page mockup만 렌더링한다', () => {
    renderPreview();

    expect(screen.getByRole('heading', { name: /에디터 Entity Page Preview/ })).toBeDefined();
    expect(screen.getByText('DEV ONLY')).toBeDefined();
    expect(screen.getByText('Phase 24 PR-3 entity workspace')).toBeDefined();
    expect(screen.getByRole('button', { name: /캐릭터5/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /김철수 상속자 범인 후보/ })).toBeDefined();
    expect(screen.getByText('참조 상태')).toBeDefined();
    expect(screen.getByText('단서 backlink')).toBeDefined();
    expect(screen.queryByText('PR-2 추천 구조 — split clue assigner')).toBeNull();
  });
});
