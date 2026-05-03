import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { EntityEditorShell } from './EntityEditorShell';

interface DemoEntity {
  id: string;
  name: string;
  description?: string;
  badges?: string[];
}

const entities: DemoEntity[] = [
  { id: 'a', name: '첫 단서', description: '서재에서 발견', badges: ['사용 가능'] },
  { id: 'b', name: '비밀 편지', description: '범인의 흔적', badges: ['미배치'] },
];

function renderShell(overrides: Partial<React.ComponentProps<typeof EntityEditorShell<DemoEntity>>> = {}) {
  return render(
    <EntityEditorShell
      title="단서"
      items={entities}
      selectedId="a"
      onSelect={vi.fn()}
      onCreate={vi.fn()}
      getItemId={(item) => item.id}
      getItemTitle={(item) => item.name}
      getItemDescription={(item) => item.description ?? ''}
      getItemBadges={(item) => item.badges ?? []}
      renderDetail={(item) => <section aria-label="상세 슬롯">{item.name} 상세</section>}
      renderInspector={(item) => <aside aria-label="검수 슬롯">{item.name} 검수</aside>}
      {...overrides}
    />,
  );
}

afterEach(cleanup);

describe('EntityEditorShell', () => {
  it('목록, 상세 슬롯, 검수 슬롯을 모바일 우선 흐름으로 렌더링한다', () => {
    renderShell();

    expect(screen.getByRole('region', { name: '단서 목록' })).toBeDefined();
    expect(screen.getByLabelText('상세 슬롯').textContent).toContain('첫 단서 상세');
    expect(screen.getByLabelText('검수 슬롯').textContent).toContain('첫 단서 검수');
    expect(screen.getByText('2개의 단서')).toBeDefined();
  });

  it('검색어에 맞는 항목만 보여준다', () => {
    renderShell();

    fireEvent.change(screen.getByLabelText('단서 검색'), { target: { value: '편지' } });

    const list = screen.getByRole('region', { name: '단서 목록' });
    expect(within(list).getByText('비밀 편지')).toBeDefined();
    expect(within(list).queryByText('첫 단서')).toBeNull();
  });


  it('검색 결과가 있으면 상세 패널도 필터된 첫 항목과 일치한다', () => {
    renderShell({ selectedId: 'a' });

    fireEvent.change(screen.getByLabelText('단서 검색'), { target: { value: '편지' } });

    expect(screen.getByLabelText('상세 슬롯').textContent).toContain('비밀 편지 상세');
    expect(screen.getByLabelText('검수 슬롯').textContent).toContain('비밀 편지 검수');
  });

  it('선택된 항목을 색상 외 텍스트와 ARIA 상태로도 표시한다', () => {
    renderShell({ selectedId: 'a' });

    expect(screen.getByRole('button', { name: '첫 단서 선택' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '비밀 편지 선택' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('선택됨')).toBeDefined();
  });

  it('부모의 선택 ID가 목록에서 사라지면 첫 항목으로 선택을 보정한다', async () => {
    const onSelect = vi.fn();
    const { rerender } = renderShell({ onSelect });

    rerender(
      <EntityEditorShell
        title="단서"
        items={[entities[1]]}
        selectedId="a"
        onSelect={onSelect}
        getItemId={(item) => item.id}
        getItemTitle={(item) => item.name}
        getItemDescription={(item) => item.description ?? ''}
        getItemBadges={(item) => item.badges ?? []}
        renderDetail={(item) => <section aria-label="상세 슬롯">{item.name} 상세</section>}
      />,
    );

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith('b'));
  });

  it('검색 결과가 없으면 이전 선택 상세를 숨긴다', () => {
    renderShell({ selectedId: 'a' });

    fireEvent.change(screen.getByLabelText('단서 검색'), { target: { value: '없는 단서' } });

    expect(screen.getByText('검색 결과가 없습니다.')).toBeDefined();
    expect(screen.queryByLabelText('상세 슬롯')).toBeNull();
  });

  it('항목 선택과 추가 액션을 parent callback으로 전달한다', () => {
    const onSelect = vi.fn();
    const onCreate = vi.fn();
    renderShell({ onSelect, onCreate });

    fireEvent.click(screen.getByRole('button', { name: '비밀 편지 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '단서 추가' }));

    expect(onSelect).toHaveBeenCalledWith('b');
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('항목이 없으면 제작자가 이해할 수 있는 빈 상태를 보여준다', () => {
    renderShell({ items: [], selectedId: undefined });

    expect(screen.getByText('아직 단서가 없습니다')).toBeDefined();
    expect(screen.getByText('새 단서를 추가해 제작을 시작하세요.')).toBeDefined();
  });
});
