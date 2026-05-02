import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Phase24ImageRoleSheetPreviewPage from './Phase24ImageRoleSheetPreviewPage';

afterEach(() => {
  cleanup();
});

describe('Phase24ImageRoleSheetPreviewPage', () => {
  it('이미지 롤지 viewer를 실제 페이지처럼 렌더링하고 페이지를 넘긴다', () => {
    render(<Phase24ImageRoleSheetPreviewPage />);

    expect(screen.getByRole('heading', { name: /이미지 롤지 Viewer Preview/ })).toBeDefined();
    expect(screen.getByText('DEV ONLY')).toBeDefined();
    expect(screen.getByText('이미지 롤지')).toBeDefined();
    expect(screen.getByText('1 / 3페이지')).toBeDefined();
    expect(screen.getByAltText('홍길동 이미지 롤지 1페이지')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '다음 이미지 페이지' }));

    expect(screen.getByText('2 / 3페이지')).toBeDefined();
    expect(screen.getByAltText('홍길동 이미지 롤지 2페이지')).toBeDefined();
  });
});
