import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import {
  mutateMock,
  renderLocationsSubTab,
  setupDefaultMocks,
  updateConfigMutateMock,
  useEditorLocationsMock,
  useEditorMapsMock,
  useMediaListMock,
} from './locationsSubTabTestUtils';

describe('LocationsSubTab', () => {
  describe('로딩 상태', () => {
    it('맵 로딩 중일 때 스피너를 표시한다', () => {
      setupDefaultMocks();
      useEditorMapsMock.mockReturnValue({ data: undefined, isLoading: true });
      useEditorLocationsMock.mockReturnValue({ data: undefined, isLoading: false });
      useMediaListMock.mockReturnValue({ data: [], isLoading: false });

      const { container } = renderLocationsSubTab();
      const spinner = container.querySelector('[role="status"]');
      expect(spinner).not.toBeNull();
    });
  });

  describe('맵 목록 렌더링', () => {
    beforeEach(setupDefaultMocks);

    it('맵 이름들을 렌더링한다', () => {
      const { container } = renderLocationsSubTab();
      expect(container.firstElementChild?.className).toContain('overflow-y-auto');
      expect(container.firstElementChild?.className).toContain('md:overflow-hidden');
      expect(screen.getAllByText('저택 1층').length).toBeGreaterThan(0);
      expect(screen.getByText('저택 2층')).toBeDefined();
    });

    it('맵이 없을 때 빈 상태를 표시한다', () => {
      useEditorMapsMock.mockReturnValue({ data: [], isLoading: false });
      renderLocationsSubTab();
      expect(screen.getByText('맵 없음')).toBeDefined();
    });

    it('맵 추가 버튼이 존재한다', () => {
      renderLocationsSubTab();
      const addBtn = screen.getByLabelText('맵 추가');
      expect(addBtn).toBeDefined();
    });
  });

  describe('맵 추가 UI', () => {
    beforeEach(setupDefaultMocks);

    it('맵 추가 버튼 클릭 시 인라인 입력이 나타난다', () => {
      renderLocationsSubTab();
      fireEvent.click(screen.getByLabelText('맵 추가'));
      expect(screen.getByPlaceholderText('맵 이름')).toBeDefined();
    });

    it('취소 버튼 클릭 시 입력 필드가 사라진다', () => {
      renderLocationsSubTab();
      fireEvent.click(screen.getByLabelText('맵 추가'));
      expect(screen.getByPlaceholderText('맵 이름')).toBeDefined();
      fireEvent.click(screen.getByText('취소'));
      expect(screen.queryByPlaceholderText('맵 이름')).toBeNull();
    });

    it('Enter 키로 맵을 추가하면 mutate가 호출된다', () => {
      renderLocationsSubTab();
      fireEvent.click(screen.getByLabelText('맵 추가'));
      const input = screen.getByPlaceholderText('맵 이름');
      fireEvent.change(input, { target: { value: '새 맵' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(mutateMock).toHaveBeenCalledWith({ name: '새 맵' }, expect.any(Object));
    });
  });

  describe('맵 삭제 UI', () => {
    beforeEach(setupDefaultMocks);

    it('맵 삭제 버튼이 각 맵에 존재한다', () => {
      renderLocationsSubTab();
      const deleteBtn = screen.getByLabelText('저택 1층 삭제');
      expect(deleteBtn).toBeDefined();
    });

    it('맵 삭제 버튼 클릭 시 mutate가 호출된다', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderLocationsSubTab();
      fireEvent.click(screen.getByLabelText('저택 1층 삭제'));
      expect(mutateMock).toHaveBeenCalledWith('map-1', expect.any(Object));
    });
  });

  describe('장소 목록 렌더링', () => {
    beforeEach(setupDefaultMocks);

    it('직접 진입 시 첫 맵의 공통 엔티티 Shell을 바로 표시한다', () => {
      renderLocationsSubTab();
      expect(screen.getByRole('region', { name: '장소 목록' })).toBeDefined();
      expect(screen.getAllByText('거실').length).toBeGreaterThan(0);
    });

    it('맵 선택 시 공통 엔티티 Shell로 해당 맵의 장소만 표시한다', () => {
      renderLocationsSubTab();
      expect(screen.getByRole('region', { name: '장소 목록' })).toBeDefined();
      // LocationDetailPanel row + clue-assignment picker option 두 곳에서 렌더됨
      expect(screen.getAllByText('거실').length).toBeGreaterThan(0);
      expect(screen.getAllByText('주방').length).toBeGreaterThan(0);
      // 다른 맵의 장소는 표시되지 않아야 함
      expect(screen.queryByText('침실')).toBeNull();
    });

    it('다른 맵을 선택하면 해당 맵의 장소 workspace로 전환한다', () => {
      renderLocationsSubTab();

      fireEvent.click(screen.getByRole('button', { name: '저택 2층' }));

      expect(screen.getByRole('region', { name: '장소 목록' })).toBeDefined();
      expect(screen.getAllByText('침실').length).toBeGreaterThan(0);
      expect(screen.queryByText('거실')).toBeNull();
      expect(screen.queryByText('주방')).toBeNull();
    });

    it('선택한 맵에 장소가 없을 때 빈 상태를 표시한다', () => {
      useEditorLocationsMock.mockReturnValue({ data: [], isLoading: false });
      renderLocationsSubTab();
      expect(screen.getByText('장소 없음')).toBeDefined();
    });
  });

  describe('장소 추가 UI', () => {
    beforeEach(setupDefaultMocks);

    it('맵 선택 후 장소 추가 버튼이 나타난다', () => {
      renderLocationsSubTab();
      expect(screen.getByText('장소 추가')).toBeDefined();
    });

    it('장소 추가 버튼 클릭 시 인라인 입력이 나타난다', () => {
      renderLocationsSubTab();
      fireEvent.click(screen.getByText('장소 추가'));
      expect(screen.getByPlaceholderText('장소 이름')).toBeDefined();
    });

    it('Enter 키로 장소를 추가하면 mutate가 호출된다', () => {
      renderLocationsSubTab();
      fireEvent.click(screen.getByText('장소 추가'));
      const input = screen.getByPlaceholderText('장소 이름');
      fireEvent.change(input, { target: { value: '서재' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(mutateMock).toHaveBeenCalledWith(
        { mapId: 'map-1', body: { name: '서재' } },
        expect.any(Object)
      );
    });
  });

  describe('단서 배정 패널', () => {
    beforeEach(setupDefaultMocks);

    it('맵 선택 시 장소 선택 picker 가 표시된다', () => {
      renderLocationsSubTab();
      expect(screen.getByText('전체 단서 목록')).toBeDefined();
    });

    it('location picker 를 통해 선택한 location 에 대해 LocationClueAssignPanel 이 렌더된다', () => {
      renderLocationsSubTab();
      fireEvent.click(screen.getByRole('button', { name: '주방 선택' }));
      expect(screen.getByLabelText('주방 단서 조사')).toBeDefined();
      expect(screen.getByLabelText('단검 추가')).toBeDefined();
    });

    it('chip 토글 시 useUpdateConfigJson.mutate 가 호출된다', () => {
      renderLocationsSubTab();
      fireEvent.click(screen.getByLabelText('단검 추가'));
      expect(updateConfigMutateMock).toHaveBeenCalledOnce();
      const [config] = updateConfigMutateMock.mock.calls[0] as [Record<string, unknown>];
      const locs = config.locations as Array<{
        id: string;
        locationClueConfig: { clueIds: string[] };
      }>;
      expect(locs[0]).toEqual({
        id: 'loc-1',
        locationClueConfig: { clueIds: ['clue-1'] },
      });
    });

    it('맵이 없으면 단서 배정 picker 가 표시되지 않는다', () => {
      useEditorMapsMock.mockReturnValue({ data: [], isLoading: false });
      renderLocationsSubTab();
      expect(screen.queryByText('전체 단서 목록')).toBeNull();
    });
  });

});
