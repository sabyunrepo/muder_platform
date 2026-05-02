import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Phase24LocationEntityPreviewPage from './Phase24LocationEntityPreviewPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Phase24LocationEntityPreviewPage', () => {
  it('장소 엔티티 목업을 렌더링하고 새 장소 추가 동작을 보여준다', () => {
    render(<Phase24LocationEntityPreviewPage />);

    expect(screen.getByRole('heading', { name: '장소 엔티티 설계 목업' })).toBeDefined();
    expect(screen.getByText('DEV ONLY')).toBeDefined();
    expect(screen.getByRole('group', { name: 'entity 타입 선택' })).toBeDefined();
    expect(screen.getByLabelText('장소 목록')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '장소 추가' }));
    fireEvent.change(screen.getByLabelText('새 장소 이름'), { target: { value: '응접실' } });
    fireEvent.click(screen.getByRole('button', { name: '목업에 추가되는 동작 보기' }));

    expect(screen.getByText('응접실')).toBeDefined();
    expect(screen.getByText('new')).toBeDefined();
  });

  it('장소 이미지 업로드와 장소 단서 선택 목록을 한 화면에서 확인한다', () => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:study') });
    render(<Phase24LocationEntityPreviewPage />);

    const file = new File(['mock'], 'library.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('장소 이미지 파일 선택'), {
      target: { files: [file] },
    });

    expect(screen.getByText('library.png')).toBeDefined();
    expect(screen.getByAltText('업로드한 장소 이미지 미리보기')).toBeDefined();
    expect(screen.getByText('이 장소의 단서')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /담배꽁초/ }));
    expect(screen.getAllByText('담배꽁초').length).toBeGreaterThan(1);
    expect(screen.getByText('4개')).toBeDefined();
  });
});
