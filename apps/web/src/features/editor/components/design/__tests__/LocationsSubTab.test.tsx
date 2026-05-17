import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import {
  mutateMock,
  renderLocationsSubTab,
  setupDefaultMocks,
  updateConfigMutateMock,
  updateLocationMutateMock,
  useEditorLocationsMock,
  useEditorMapsMock,
  useMediaListMock,
} from './locationsSubTabTestUtils';
import { writeLocationDiscoveries } from '@/features/editor/editorTypes';
import { baseLocation, mockTheme } from './locationsSubTabTestUtils';

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
      expect(container.firstElementChild?.className).toContain('bg-slate-950/40');
      expect(screen.getByRole('combobox', { name: '맵 선택' })).toBeDefined();
      expect(screen.queryByText('맵은 조사 단계가 아니라 장소들을 묶는 배치 컨테이너입니다.')).toBeNull();
      expect(screen.getAllByText('저택 1층').length).toBeGreaterThan(0);
      expect(screen.getByText('저택 2층')).toBeDefined();
    });

    it('모바일에서는 장소관리 탭 전체가 세로 스크롤 책임을 가진다', () => {
      renderLocationsSubTab();

      const scrollRoot = screen.getByTestId('locations-sub-tab-scroll');
      const locationList = screen.getByRole('region', { name: '장소 목록' });

      expect(scrollRoot.className).toContain('overflow-y-auto');
      expect(scrollRoot.className).toContain('md:overflow-hidden');
      expect(locationList.className).toContain('overflow-visible');
      expect(locationList.className).toContain('md:overflow-y-auto');
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
      renderLocationsSubTab();
      fireEvent.click(screen.getByLabelText('저택 1층 삭제'));
      const dialog = screen.getByRole('dialog', { name: '맵을 삭제할까요?' });
      expect(within(dialog).getByText(/저택 1층 맵과 하위 장소 편집 흐름도/)).toBeDefined();
      fireEvent.click(within(dialog).getByRole('button', { name: '맵 삭제' }));
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

    it('장소 상세에서 장소 구조 설정을 표시한다', () => {
      renderLocationsSubTab();

      expect(screen.getByText('장소 구조')).toBeDefined();
      expect(screen.getByRole('combobox', { name: '거실 상위 장소' })).toBeDefined();
      expect(screen.queryByText(/하위 조사 항목/)).toBeNull();
      expect(screen.queryByText(/2단계/)).toBeNull();
      expect(screen.getByText('소속 맵: 저택 1층')).toBeDefined();
    });

    it('장소 상세에서 장소 트리거 UI를 표시하지 않는다', () => {
      renderLocationsSubTab();

      expect(screen.queryByText('진행 연결')).toBeNull();
      expect(screen.queryByText('장소 트리거')).toBeNull();
      expect(screen.queryByRole('button', { name: '트리거 추가' })).toBeNull();
      expect(screen.queryByRole('button', { name: '트리거 저장' })).toBeNull();
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

      fireEvent.change(screen.getByRole('combobox', { name: '맵 선택' }), { target: { value: 'map-2' } });

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

    it('부모 장소 아래에 하위장소를 들여쓰기 카드로 표시한다', () => {
      useEditorLocationsMock.mockReturnValue({
        data: [
          { ...baseLocation('loc-parent', '호텔 로비'), sort_order: 0, parent_location_id: null },
          {
            ...baseLocation('loc-child', '프런트 데스크'),
            sort_order: 0,
            parent_location_id: 'loc-parent',
          },
        ],
        isLoading: false,
      });

      renderLocationsSubTab();

      expect(screen.getByRole('button', { name: '호텔 로비 선택' })).toBeDefined();
      expect(screen.getByRole('button', { name: '호텔 로비 / 프런트 데스크 선택' })).toBeDefined();
      expect(screen.getByText('직접 배치 단서 0개 · 하위장소 1개')).toBeDefined();
      expect(screen.queryByText('직접 배치 단서 0개 · 하위장소 0개')).toBeNull();
    });

    it('장소가 없는 맵에서도 장소 추가 입력을 표시한다', () => {
      useEditorLocationsMock.mockReturnValue({ data: [], isLoading: false });
      renderLocationsSubTab();

      fireEvent.click(screen.getByRole('button', { name: '장소 추가' }));

      expect(screen.getByPlaceholderText('장소 이름')).toBeDefined();
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
        { mapId: 'map-1', body: { name: '서재', parent_location_id: null } },
        expect.any(Object)
      );
    });

    it('부모 카드의 하위장소 추가 버튼은 parent_location_id를 담아 createLocation을 호출한다', () => {
      renderLocationsSubTab();
      fireEvent.click(screen.getAllByRole('button', { name: '거실 하위장소 추가' })[0]);
      const input = screen.getByPlaceholderText('하위장소 이름');
      fireEvent.change(input, { target: { value: '금고 앞' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mutateMock).toHaveBeenCalledWith(
        { mapId: 'map-1', body: { name: '금고 앞', parent_location_id: 'loc-1' } },
        expect.any(Object)
      );
    });

    it('장소 구조 패널에서 상위 장소를 바꾸면 parent_location_id를 저장한다', () => {
      renderLocationsSubTab();

      fireEvent.change(screen.getByRole('combobox', { name: '거실 상위 장소' }), {
        target: { value: 'loc-2' },
      });

      expect(updateLocationMutateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          locationId: 'loc-1',
          body: expect.objectContaining({ parent_location_id: 'loc-2' }),
        }),
        expect.any(Object)
      );
    });

    it('자식이 있는 부모 장소는 구조 패널로 다른 부모 밑에 넣을 수 없다', () => {
      useEditorLocationsMock.mockReturnValue({
        data: [
          { ...baseLocation('loc-parent', '거실'), parent_location_id: null },
          { ...baseLocation('loc-child', '프런트'), parent_location_id: 'loc-parent' },
          { ...baseLocation('loc-target', '주방'), parent_location_id: null },
        ],
        isLoading: false,
      });
      renderLocationsSubTab();

      fireEvent.change(screen.getByRole('combobox', { name: '거실 상위 장소' }), {
        target: { value: 'loc-target' },
      });

      expect(updateLocationMutateMock).not.toHaveBeenCalled();
    });

    it('드래그앤드롭으로 부모 장소 아래 이동 시 parent_location_id payload를 저장한다', () => {
      renderLocationsSubTab();
      const dataTransfer = createDataTransfer();

      fireEvent.dragStart(screen.getByLabelText('주방 드래그 영역'), { dataTransfer });
      fireEvent.drop(screen.getByLabelText('거실 드래그 영역'), { dataTransfer });

      expect(updateLocationMutateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          locationId: 'loc-2',
          body: expect.objectContaining({ parent_location_id: 'loc-1' }),
        }),
        expect.any(Object)
      );
    });

    it('드래그앤드롭으로 하위장소를 최상위로 이동하면 parent_location_id null을 저장한다', () => {
      useEditorLocationsMock.mockReturnValue({
        data: [
          { ...baseLocation('loc-parent', '거실'), parent_location_id: null },
          { ...baseLocation('loc-child', '프런트'), parent_location_id: 'loc-parent' },
        ],
        isLoading: false,
      });
      renderLocationsSubTab();
      const dataTransfer = createDataTransfer();

      fireEvent.dragStart(screen.getByLabelText('프런트 드래그 영역'), { dataTransfer });
      fireEvent.drop(screen.getByLabelText('최상위 장소 드롭 영역'), { dataTransfer });

      expect(updateLocationMutateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          locationId: 'loc-child',
          body: expect.objectContaining({ parent_location_id: null }),
        }),
        expect.any(Object)
      );
    });

    it('드래그앤드롭으로 하위장소 아래 이동하려 하면 차단한다', () => {
      useEditorLocationsMock.mockReturnValue({
        data: [
          { ...baseLocation('loc-parent', '거실'), parent_location_id: null },
          { ...baseLocation('loc-child', '프런트'), parent_location_id: 'loc-parent' },
          { ...baseLocation('loc-source', '주방'), parent_location_id: null },
        ],
        isLoading: false,
      });
      renderLocationsSubTab();
      const dataTransfer = createDataTransfer();

      fireEvent.dragStart(screen.getByLabelText('주방 드래그 영역'), { dataTransfer });
      fireEvent.drop(screen.getByLabelText('프런트 드래그 영역'), { dataTransfer });

      expect(updateLocationMutateMock).not.toHaveBeenCalled();
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

    it('배정된 단서는 해제할 수 있고 선택한 단서 하나의 조사 설정만 표시한다', () => {
      const config = writeLocationDiscoveries(null, 'loc-1', [
        { locationId: 'loc-1', clueId: 'clue-1', requiredClueIds: [], oncePerPlayer: true },
      ]);
      renderLocationsSubTab({ ...mockTheme, config_json: config });

      expect(screen.getByText('조사 설정')).toBeDefined();
      expect(screen.queryByText('조사 결과')).toBeNull();
      expect((screen.getByLabelText('단검 무료 조사') as HTMLInputElement).checked).toBe(false);
      expect(screen.queryByLabelText('단검 조사권 종류')).toBeNull();
      expect(screen.getByLabelText('단검 조사권 소비량')).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: '단검 해제' }));
      expect(updateConfigMutateMock).toHaveBeenCalledOnce();
    });

    it('무료 조사를 체크하면 조사권 필드 대신 무료 비용 설정을 저장한다', () => {
      const config = writeLocationDiscoveries(null, 'loc-1', [
        { locationId: 'loc-1', clueId: 'clue-1', requiredClueIds: [], oncePerPlayer: true },
      ]);
      renderLocationsSubTab({ ...mockTheme, config_json: config });

      fireEvent.click(screen.getByLabelText('단검 무료 조사'));

      expect(updateConfigMutateMock).toHaveBeenCalledOnce();
      const [nextConfig] = updateConfigMutateMock.mock.calls[0] as [Record<string, unknown>];
      const modules = nextConfig.modules as {
        deck_investigation: { config: { decks: Array<{ tokenCost: number }> } };
      };
      const deckConfig = modules.deck_investigation.config;
      expect(deckConfig.decks[0]?.tokenCost).toBe(0);
    });

    it('장소 덱 단서를 드래그앤드롭으로 재정렬하면 순서를 저장한다', () => {
      const config = writeLocationDiscoveries(null, 'loc-1', [
        {
          locationId: 'loc-1',
          clueId: 'clue-1',
          requiredClueIds: [],
          oncePerPlayer: true,
          order: 0,
        },
        {
          locationId: 'loc-1',
          clueId: 'clue-2',
          requiredClueIds: [],
          oncePerPlayer: true,
          order: 1,
        },
      ]);
      renderLocationsSubTab({ ...mockTheme, config_json: config });

      fireEvent.dragStart(screen.getByLabelText('단검 순서 이동'));
      fireEvent.dragEnter(screen.getByLabelText('서류 순서 이동'));
      fireEvent.drop(screen.getByLabelText('서류 순서 이동'));

      expect(updateConfigMutateMock).toHaveBeenCalledOnce();
      const [nextConfig] = updateConfigMutateMock.mock.calls[0] as [Record<string, unknown>];
      const modules = nextConfig.modules as {
        location: {
          config: {
            discoveries: Array<{ clueId: string; order?: number }>;
          };
        };
      };
      const reordered = modules.location.config.discoveries.filter((item) => item.locationId === 'loc-1');
      expect(reordered.map((item) => [item.clueId, item.order])).toEqual([
        ['clue-2', 0],
        ['clue-1', 1],
      ]);
    });

    it('맵이 없으면 단서 배정 picker 가 표시되지 않는다', () => {
      useEditorMapsMock.mockReturnValue({ data: [], isLoading: false });
      renderLocationsSubTab();
      expect(screen.queryByText('전체 단서 목록')).toBeNull();
    });
  });

});

function createDataTransfer(): DataTransfer {
  const data = new Map<string, string>();
  return {
    effectAllowed: 'move',
    dropEffect: 'move',
    setData: (format: string, value: string) => data.set(format, value),
    getData: (format: string) => data.get(format) ?? '',
  } as DataTransfer;
}
