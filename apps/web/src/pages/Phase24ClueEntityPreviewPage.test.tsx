import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import Phase24ClueEntityPreviewPage from './Phase24ClueEntityPreviewPage';

afterEach(cleanup);

describe('Phase24ClueEntityPreviewPage', () => {
  it('단서 엔티티 목업의 목록, 상세, 검수 패널을 렌더링하고 검색/신규 토글을 보여준다', () => {
    render(<Phase24ClueEntityPreviewPage />);

    expect(screen.getByRole('heading', { name: '단서 엔티티 설계 목업' })).toBeDefined();
    expect(screen.getByText('DEV ONLY')).toBeDefined();
    expect(screen.getByText('단서 공유 정책 설정')).toBeDefined();
    expect(screen.getByText('단서 사용 효과 설정')).toBeDefined();
    expect(screen.getByText('조합 조건 설정')).toBeDefined();
    expect(screen.getByText('제작 검수')).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText('단서명 또는 태그 검색'), {
      target: { value: '편지' },
    });

    const list = screen.getByLabelText('단서 카드 목록');
    expect(within(list).getByText('찢어진 편지')).toBeDefined();
    expect(within(list).queryByText('담배꽁초')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '새 단서 추가' }));
    expect(screen.getByText('새 단서 추가 흐름')).toBeDefined();
  });

  it('단서 이미지 업로드 파일명을 상세 패널에 반영한다', () => {
    render(<Phase24ClueEntityPreviewPage />);

    const imageInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['mock'], 'safe-photo.png', { type: 'image/png' });
    fireEvent.change(imageInput, { target: { files: [file] } });

    expect(screen.getByText('safe-photo.png')).toBeDefined();
  });

  it('사용 효과를 플레이어 단서 열람으로 바꾸고 대상 단서를 검색 선택한다', () => {
    render(<Phase24ClueEntityPreviewPage />);

    fireEvent.click(screen.getByRole('button', { name: /다른 플레이어 단서 보기/ }));
    expect(screen.getByText('플레이어가 단서를 사용할 때 대상 플레이어를 직접 고릅니다.')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /제작자가 지정한 단서/ }));
    fireEvent.change(screen.getByPlaceholderText('대상 단서 검색'), {
      target: { value: '금고' },
    });
    fireEvent.click(screen.getByRole('button', { name: /볼 단서 지정: 금고 비밀번호 조각/ }));

    expect(screen.getByText('선택됨: 금고 비밀번호 조각')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /효과 발동 후 소모/ }));
    expect(screen.getByText(/이 단서는 단서함에서 사라집니다/)).toBeDefined();
  });

  it('잠긴 단서 공개, 조건 해제, 조합 보상 흐름의 선택 UI를 보여준다', () => {
    render(<Phase24ClueEntityPreviewPage />);

    fireEvent.click(screen.getByRole('button', { name: /잠긴 단서 공개/ }));
    expect(screen.getByRole('button', { name: /공개할 잠긴 단서: 상자 안 편지/ })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /조건 해제/ }));
    expect(screen.getByText('해제할 조건 타입')).toBeDefined();
    expect(screen.getByText('해제할 대상')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /선택한 단서 중 하나 이상/ }));
    fireEvent.click(screen.getByLabelText(/재료 단서 소모/));
    fireEvent.click(screen.getByRole('button', { name: /검은 잉크 일기장 ×/ }));

    const rewardPicker = screen.getByText('성공 시 지급').closest('div');
    expect(rewardPicker).not.toBeNull();
    fireEvent.change(within(rewardPicker as HTMLElement).getByPlaceholderText('지급할 단서 검색'), {
      target: { value: '사진' },
    });
    fireEvent.click(screen.getByRole('button', { name: /성공 시 지급: 지하실 문 안쪽 사진/ }));

    expect(screen.getByText(/중 하나 이상을 가진 플레이어가 조합하면/)).toBeDefined();
    expect(screen.getAllByText(/지하실 문 안쪽 사진/).length).toBeGreaterThan(0);
    expect(screen.getByText(/성공 후 사라집니다/)).toBeDefined();
  });

  it('미사용 단서를 선택하면 검수 패널이 미사용 상태를 보여준다', () => {
    render(<Phase24ClueEntityPreviewPage />);

    fireEvent.click(screen.getByRole('button', { name: /담배꽁초/ }));

    expect(screen.getByText('아직 어디에도 연결되지 않은 단서입니다.')).toBeDefined();
    expect(screen.getAllByText('미사용 단서').length).toBeGreaterThan(0);
  });
});
