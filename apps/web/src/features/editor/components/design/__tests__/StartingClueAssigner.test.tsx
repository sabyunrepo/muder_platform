import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  it('단서명, 장소, 태그, 라운드로 후보 목록을 검색한다', () => {
    renderAssigner();
    const search = screen.getByRole('searchbox', { name: '시작 단서 검색' });

    expect(screen.queryByText('피 묻은 칼')).toBeNull();

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

  it('검색한 단서를 클릭하면 추가 이벤트를 보낸다', () => {
    const { onClueToggle } = renderAssigner();

    fireEvent.change(screen.getByRole('searchbox', { name: '시작 단서 검색' }), {
      target: { value: '비밀' },
    });
    fireEvent.click(screen.getByRole('button', { name: '비밀 편지 시작 단서 추가' }));

    expect(onClueToggle).toHaveBeenCalledWith('clue-2', true);
  });

  it('이미 선택된 단서는 검색 없이 먼저 보이고 제거할 수 있다', () => {
    const { onClueToggle } = renderAssigner(['clue-1']);
    expect(screen.getByText('피 묻은 칼')).toBeDefined();
    expect(screen.getByText('서재 · 물증')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '피 묻은 칼 제거' }));

    expect(onClueToggle).toHaveBeenCalledWith('clue-1', false);
  });

  it('배정된 단서가 없으면 우측 빈 상태를 표시한다', () => {
    renderAssigner();

    expect(screen.getByText('아직 배정된 단서가 없습니다. 단서명으로 검색해 시작 단서를 추가하세요.')).toBeDefined();
  });
});
