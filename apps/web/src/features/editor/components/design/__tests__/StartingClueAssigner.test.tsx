import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { StartingClueAssigner } from '../StartingClueAssigner';

const clues = [
  { id: 'clue-1', name: '피 묻은 칼', location: '서재', round: 1, tag: '물증' },
  { id: 'clue-2', name: '비밀 편지', location: '부엌', round: 1, tag: '문서' },
  { id: 'clue-3', name: '이름 없는 열쇠' },
];

function renderAssigner(selectedIds: string[] = [], onClueToggle = vi.fn()) {
  render(
    <StartingClueAssigner
      characterName="홍길동"
      clues={clues}
      selectedIds={selectedIds}
      onClueToggle={onClueToggle}
    />,
  );
  return { onClueToggle };
}

afterEach(() => {
  cleanup();
});

describe('StartingClueAssigner', () => {
  it('단서가 없으면 빈 상태를 표시한다', () => {
    render(
      <StartingClueAssigner
        characterName="홍길동"
        clues={[]}
        selectedIds={[]}
        onClueToggle={vi.fn()}
      />,
    );

    expect(screen.getByText('단서가 없습니다')).toBeDefined();
  });

  it('단서명, 장소, 태그, 라운드로 좌측 목록을 검색한다', () => {
    renderAssigner();
    const search = screen.getByRole('textbox', { name: '단서 검색' });

    fireEvent.change(search, { target: { value: '부엌' } });
    expect(screen.queryByText('피 묻은 칼')).toBeNull();
    expect(screen.getByText('비밀 편지')).toBeDefined();

    fireEvent.change(search, { target: { value: '물증' } });
    expect(screen.getByText('피 묻은 칼')).toBeDefined();
    expect(screen.queryByText('비밀 편지')).toBeNull();

    fireEvent.change(search, { target: { value: '1' } });
    expect(screen.getByText('피 묻은 칼')).toBeDefined();
    expect(screen.getByText('비밀 편지')).toBeDefined();

    fireEvent.change(search, { target: { value: '없음' } });
    expect(screen.getByText('검색 결과가 없습니다.')).toBeDefined();
  });

  it('좌측 단서를 클릭하면 추가 이벤트를 보낸다', () => {
    const { onClueToggle } = renderAssigner();

    fireEvent.click(screen.getByRole('button', { name: /비밀 편지/ }));

    expect(onClueToggle).toHaveBeenCalledWith('clue-2', true);
  });

  it('이미 선택된 단서는 좌측에서 비활성화되고 우측에서 제거할 수 있다', () => {
    const { onClueToggle } = renderAssigner(['clue-1']);
    const listSection = screen.getByText('전체 단서 목록').closest('section');
    const assignedSection = screen.getAllByText('홍길동의 시작 단서')[0].closest('section');
    expect(listSection).not.toBeNull();
    expect(assignedSection).not.toBeNull();

    expect(within(listSection as HTMLElement).getByRole('button', { name: /피 묻은 칼/ }).disabled).toBe(true);
    expect(screen.getByText('추가됨')).toBeDefined();
    expect(within(assignedSection as HTMLElement).getByText('서재 · 물증')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '피 묻은 칼 제거' }));

    expect(onClueToggle).toHaveBeenCalledWith('clue-1', false);
  });

  it('배정된 단서가 없으면 우측 빈 상태를 표시한다', () => {
    renderAssigner();

    expect(screen.getByText('아직 배정된 단서가 없습니다. 좌측 목록에서 단서를 클릭하세요.')).toBeDefined();
  });
});
