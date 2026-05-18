import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClueSearchMultiSelect, type ClueSearchSelectItem } from '../ClueSearchMultiSelect';

const items: ClueSearchSelectItem[] = [
  { id: 'clue-1', name: '우산걸이', meta: '장소 단서 · 공용', badge: 'CL' },
  { id: 'clue-2', name: '책장', meta: '장소 단서', badge: 'R1' },
  { id: 'clue-3', name: '프런트 데스크', meta: '미배치', badge: 'CL' },
];

function renderPicker(overrides: Partial<React.ComponentProps<typeof ClueSearchMultiSelect<ClueSearchSelectItem>>> = {}) {
  const onAdd = vi.fn();
  const onRemove = vi.fn();
  const onSelectSelected = vi.fn();
  render(
    <ClueSearchMultiSelect
      title="배치된 단서"
      items={items}
      selectedIds={[]}
      searchLabel="단서 검색"
      searchPlaceholder="단서명 검색"
      emptySelectedText="선택된 단서가 없습니다."
      idleSearchText="검색어를 입력하세요."
      onAdd={onAdd}
      onRemove={onRemove}
      onSelectSelected={onSelectSelected}
      {...overrides}
    />,
  );
  return { onAdd, onRemove, onSelectSelected };
}

afterEach(() => {
  cleanup();
});

describe('ClueSearchMultiSelect', () => {
  it('검색어가 없으면 후보 전체를 펼치지 않는다', () => {
    renderPicker();

    expect(screen.getByText('선택된 단서가 없습니다.')).toBeDefined();
    expect(screen.getByText('검색어를 입력하세요.')).toBeDefined();
    expect(screen.queryByText('우산걸이')).toBeNull();
    expect(screen.queryByText('책장')).toBeNull();
  });

  it('검색 결과에서 항목을 추가한다', () => {
    const { onAdd } = renderPicker();

    fireEvent.change(screen.getByRole('searchbox', { name: '단서 검색' }), {
      target: { value: '책장' },
    });
    fireEvent.click(screen.getByRole('button', { name: '책장 추가' }));

    expect(onAdd).toHaveBeenCalledWith('clue-2');
  });

  it('선택된 항목은 검색 없이 먼저 보이고 제거할 수 있다', () => {
    const { onRemove, onSelectSelected } = renderPicker({
      selectedIds: ['clue-1'],
      getRemoveAriaLabel: (item) => `${item.name} 해제`,
      getSelectedAriaLabel: (item) => `${item.name} 설정 열기`,
    });

    fireEvent.click(screen.getByRole('button', { name: '우산걸이 설정 열기' }));
    fireEvent.click(screen.getByRole('button', { name: '우산걸이 해제' }));

    expect(onSelectSelected).toHaveBeenCalledWith('clue-1');
    expect(onRemove).toHaveBeenCalledWith('clue-1');
  });

  it('비활성 후보는 추가하지 못하게 막는다', () => {
    renderPicker({
      getDisabledReason: (item) => (item.id === 'clue-3' ? '배치됨' : null),
    });

    fireEvent.change(screen.getByRole('searchbox', { name: '단서 검색' }), {
      target: { value: '프런트' },
    });

    expect((screen.getByRole('button', { name: '프런트 데스크 추가' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('배치됨')).toBeDefined();
  });
});
