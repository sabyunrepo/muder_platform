import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  toastSuccess,
  toastError,
  mutateMock,
  updateConfigMutateMock,
  updateLocationMutateMock,
  useEditorCharactersMock,
  useEditorMapsMock,
  useCreateMapMock,
  useDeleteMapMock,
  useEditorLocationsMock,
  useCreateLocationMock,
  useDeleteLocationMock,
  useUpdateLocationMock,
  useEditorCluesMock,
  useUpdateConfigJsonMock,
} = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  mutateMock: vi.fn(),
  updateConfigMutateMock: vi.fn(),
  updateLocationMutateMock: vi.fn(),
  useEditorCharactersMock: vi.fn(),
  useEditorMapsMock: vi.fn(),
  useCreateMapMock: vi.fn(),
  useDeleteMapMock: vi.fn(),
  useEditorLocationsMock: vi.fn(),
  useCreateLocationMock: vi.fn(),
  useDeleteLocationMock: vi.fn(),
  useUpdateLocationMock: vi.fn(),
  useEditorCluesMock: vi.fn(),
  useUpdateConfigJsonMock: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock: sonner
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError },
}));

// ---------------------------------------------------------------------------
// Mock: @/features/editor/api
// ---------------------------------------------------------------------------

vi.mock('@/features/editor/api', () => ({
  useEditorCharacters: () => useEditorCharactersMock(),
  useEditorMaps: () => useEditorMapsMock(),
  useCreateMap: () => useCreateMapMock(),
  useDeleteMap: () => useDeleteMapMock(),
  useEditorLocations: () => useEditorLocationsMock(),
  useCreateLocation: () => useCreateLocationMock(),
  useDeleteLocation: () => useDeleteLocationMock(),
  useUpdateLocation: () => useUpdateLocationMock(),
  useEditorClues: () => useEditorCluesMock(),
  useUpdateConfigJson: () => useUpdateConfigJsonMock(),
  editorKeys: {
    theme: (id: string) => ['editor', 'themes', id] as const,
  },
}));

// LocationClueAssignPanel (via LocationsSubTab) now calls `useQueryClient`; stub
// it so the existing tests don't need a real provider.
vi.mock('@tanstack/react-query', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      getQueryData: () => undefined,
      setQueryData: () => undefined,
    }),
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { LocationsSubTab } from '../LocationsSubTab';

import {
  mockCharacters,
  mockClues,
  mockLocations,
  mockMaps,
  mockTheme,
} from './locationsSubTabTestData';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultMutation() {
  return { mutate: mutateMock, isPending: false };
}

function setupDefaultMocks() {
  useEditorCharactersMock.mockReturnValue({ data: mockCharacters, isLoading: false });
  useEditorMapsMock.mockReturnValue({ data: mockMaps, isLoading: false });
  useEditorLocationsMock.mockReturnValue({ data: mockLocations, isLoading: false });
  useCreateMapMock.mockReturnValue(defaultMutation());
  useDeleteMapMock.mockReturnValue(defaultMutation());
  useCreateLocationMock.mockReturnValue(defaultMutation());
  useDeleteLocationMock.mockReturnValue(defaultMutation());
  useUpdateLocationMock.mockReturnValue({
    mutate: updateLocationMutateMock,
    isPending: false,
  });
  useEditorCluesMock.mockReturnValue({ data: mockClues, isLoading: false });
  useUpdateConfigJsonMock.mockReturnValue({
    mutate: updateConfigMutateMock,
    isPending: false,
  });
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LocationsSubTab', () => {
  describe('로딩 상태', () => {
    it('맵 로딩 중일 때 스피너를 표시한다', () => {
      useEditorCharactersMock.mockReturnValue({ data: mockCharacters, isLoading: false });
      useEditorMapsMock.mockReturnValue({ data: undefined, isLoading: true });
      useEditorLocationsMock.mockReturnValue({ data: undefined, isLoading: false });
      useCreateMapMock.mockReturnValue(defaultMutation());
      useDeleteMapMock.mockReturnValue(defaultMutation());
      useCreateLocationMock.mockReturnValue(defaultMutation());
      useDeleteLocationMock.mockReturnValue(defaultMutation());
      useUpdateLocationMock.mockReturnValue({
        mutate: updateLocationMutateMock,
        isPending: false,
      });
      useEditorCluesMock.mockReturnValue({ data: [], isLoading: false });
      useUpdateConfigJsonMock.mockReturnValue({
        mutate: updateConfigMutateMock,
        isPending: false,
      });

      const { container } = render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      const spinner = container.querySelector('[role="status"]');
      expect(spinner).not.toBeNull();
    });
  });

  describe('맵 목록 렌더링', () => {
    beforeEach(setupDefaultMocks);

    it('맵 이름들을 렌더링한다', () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      expect(screen.getByText('저택 1층')).toBeDefined();
      expect(screen.getByText('저택 2층')).toBeDefined();
    });

    it('맵이 없을 때 빈 상태를 표시한다', () => {
      useEditorMapsMock.mockReturnValue({ data: [], isLoading: false });
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      expect(screen.getByText('맵 없음')).toBeDefined();
    });

    it('맵 추가 버튼이 존재한다', () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      const addBtn = screen.getByLabelText('맵 추가');
      expect(addBtn).toBeDefined();
    });
  });

  describe('맵 추가 UI', () => {
    beforeEach(setupDefaultMocks);

    it('맵 추가 버튼 클릭 시 인라인 입력이 나타난다', () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      fireEvent.click(screen.getByLabelText('맵 추가'));
      expect(screen.getByPlaceholderText('맵 이름')).toBeDefined();
    });

    it('취소 버튼 클릭 시 입력 필드가 사라진다', () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      fireEvent.click(screen.getByLabelText('맵 추가'));
      expect(screen.getByPlaceholderText('맵 이름')).toBeDefined();
      fireEvent.click(screen.getByText('취소'));
      expect(screen.queryByPlaceholderText('맵 이름')).toBeNull();
    });

    it('Enter 키로 맵을 추가하면 mutate가 호출된다', () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
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
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      const deleteBtn = screen.getByLabelText('저택 1층 삭제');
      expect(deleteBtn).toBeDefined();
    });

    it('맵 삭제 버튼 클릭 시 mutate가 호출된다', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      fireEvent.click(screen.getByLabelText('저택 1층 삭제'));
      expect(mutateMock).toHaveBeenCalledWith('map-1', expect.any(Object));
    });
  });

  describe('장소 목록 렌더링', () => {
    beforeEach(setupDefaultMocks);

    it('맵 미선택 시 empty state를 표시한다', () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      expect(screen.getByText('좌측에서 맵을 선택하세요')).toBeDefined();
    });

    it('맵 선택 시 해당 맵의 장소만 표시한다', () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      fireEvent.click(screen.getByText('저택 1층'));
      // LocationDetailPanel row + clue-assignment picker option 두 곳에서 렌더됨
      expect(screen.getAllByText('거실').length).toBeGreaterThan(0);
      expect(screen.getAllByText('주방').length).toBeGreaterThan(0);
      // 다른 맵의 장소는 표시되지 않아야 함
      expect(screen.queryByText('침실')).toBeNull();
    });

    it('선택한 맵에 장소가 없을 때 빈 상태를 표시한다', () => {
      useEditorLocationsMock.mockReturnValue({ data: [], isLoading: false });
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      fireEvent.click(screen.getByText('저택 1층'));
      expect(screen.getByText('장소 없음')).toBeDefined();
    });
  });

  describe('장소 추가 UI', () => {
    beforeEach(setupDefaultMocks);

    it('맵 선택 후 장소 추가 버튼이 나타난다', () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      fireEvent.click(screen.getByText('저택 1층'));
      expect(screen.getByText('장소 추가')).toBeDefined();
    });

    it('장소 추가 버튼 클릭 시 인라인 입력이 나타난다', () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      fireEvent.click(screen.getByText('저택 1층'));
      fireEvent.click(screen.getByText('장소 추가'));
      expect(screen.getByPlaceholderText('장소 이름')).toBeDefined();
    });

    it('Enter 키로 장소를 추가하면 mutate가 호출된다', () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      fireEvent.click(screen.getByText('저택 1층'));
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
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      fireEvent.click(screen.getByText('저택 1층'));
      expect(screen.getByText('전체 단서 목록')).toBeDefined();
    });

    it('location picker 를 통해 선택한 location 에 대해 LocationClueAssignPanel 이 렌더된다', () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      fireEvent.click(screen.getByText('저택 1층'));
      fireEvent.click(screen.getByRole('button', { name: '주방' }));
      expect(screen.getByLabelText('주방 단서 배정')).toBeDefined();
      expect(screen.getByLabelText('단검 추가')).toBeDefined();
    });

    it('chip 토글 시 useUpdateConfigJson.mutate 가 호출된다', () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      fireEvent.click(screen.getByText('저택 1층'));
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

    it('맵 미선택 상태에서는 단서 배정 picker 가 표시되지 않는다', () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      expect(screen.queryByText('전체 단서 목록')).toBeNull();
    });
  });

  describe('LocationRow 라운드 편집', () => {
    beforeEach(setupDefaultMocks);

    it('등장/퇴장 라운드 입력이 각 장소 행마다 존재한다', () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      fireEvent.click(screen.getByText('저택 1층'));
      expect(screen.getByLabelText('거실 등장 라운드')).toBeDefined();
      expect(screen.getByLabelText('거실 퇴장 라운드')).toBeDefined();
    });

    it('라운드 값 입력 후 blur 하면 useUpdateLocation.mutate 가 호출된다', () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      fireEvent.click(screen.getByText('저택 1층'));
      const fromInput = screen.getByLabelText('거실 등장 라운드') as HTMLInputElement;
      fireEvent.change(fromInput, { target: { value: '2' } });
      fireEvent.blur(fromInput);
      expect(updateLocationMutateMock).toHaveBeenCalledOnce();
      const [payload] = updateLocationMutateMock.mock.calls[0] as [
        { locationId: string; body: Record<string, unknown> },
      ];
      expect(payload.locationId).toBe('loc-1');
      expect(payload.body.from_round).toBe(2);
      expect(payload.body.name).toBe('거실');
    });

    it('등장 > 퇴장 조합은 에러 토스트 후 저장되지 않는다', () => {
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      fireEvent.click(screen.getByText('저택 1층'));
      const fromInput = screen.getByLabelText('거실 등장 라운드') as HTMLInputElement;
      const untilInput = screen.getByLabelText('거실 퇴장 라운드') as HTMLInputElement;
      fireEvent.change(untilInput, { target: { value: '2' } });
      fireEvent.blur(untilInput);
      updateLocationMutateMock.mockClear();
      fireEvent.change(fromInput, { target: { value: '5' } });
      fireEvent.blur(fromInput);
      expect(updateLocationMutateMock).not.toHaveBeenCalled();
      expect(toastError).toHaveBeenCalledWith('등장 라운드는 퇴장 라운드보다 클 수 없습니다');
    });

    it('값을 비우면 from_round 가 null 로 저장된다', () => {
      useEditorLocationsMock.mockReturnValue({
        data: [{ ...mockLocations[0], from_round: 2, until_round: 5 }, ...mockLocations.slice(1)],
        isLoading: false,
      });
      render(<LocationsSubTab themeId="theme-1" theme={mockTheme} />);
      fireEvent.click(screen.getByText('저택 1층'));
      const fromInput = screen.getByLabelText('거실 등장 라운드') as HTMLInputElement;
      fireEvent.change(fromInput, { target: { value: '' } });
      fireEvent.blur(fromInput);
      expect(updateLocationMutateMock).toHaveBeenCalledOnce();
      const [payload] = updateLocationMutateMock.mock.calls[0] as [
        { body: Record<string, unknown> },
      ];
      expect(payload.body.from_round).toBeNull();
      expect(payload.body.until_round).toBe(5);
    });
  });
});
