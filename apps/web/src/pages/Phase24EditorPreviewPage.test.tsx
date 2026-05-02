import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import Phase24EditorPreviewPage from './Phase24EditorPreviewPage';

afterEach(() => {
  cleanup();
});

describe('Phase24EditorPreviewPage', () => {
  it('Phase 24 에디터 preview를 렌더링하고 split assigner 변경을 JSON에 반영한다', () => {
    render(<Phase24EditorPreviewPage />);

    expect(screen.getByRole('heading', { name: /에디터 작업 미리보기/ })).toBeDefined();
    expect(screen.getByText('DEV ONLY')).toBeDefined();
    expect(screen.getAllByText('전체 단서 목록').length).toBeGreaterThan(0);
    expect(screen.getAllByText('홍길동의 시작 단서').length).toBeGreaterThan(0);

    const splitSection = screen.getByText('추천 구조 — split clue assigner').closest('section');
    expect(splitSection).not.toBeNull();

    fireEvent.change(within(splitSection as HTMLElement).getByRole('textbox', { name: '단서 검색' }), {
      target: { value: '녹음' },
    });
    fireEvent.click(within(splitSection as HTMLElement).getByRole('button', { name: /녹음 파일/ }));

    expect(screen.getByText(/"clue-5"/)).toBeDefined();
  });
});
