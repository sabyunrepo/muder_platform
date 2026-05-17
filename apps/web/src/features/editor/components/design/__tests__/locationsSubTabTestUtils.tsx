import { afterEach, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

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
  useUpdateMapMock,
  useEditorLocationsMock,
  useCreateLocationMock,
  useDeleteLocationMock,
  useUpdateLocationMock,
  useEditorCluesMock,
  useUpdateConfigJsonMock,
  useMediaListMock,
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
  useUpdateMapMock: vi.fn(),
  useEditorLocationsMock: vi.fn(),
  useCreateLocationMock: vi.fn(),
  useDeleteLocationMock: vi.fn(),
  useUpdateLocationMock: vi.fn(),
  useEditorCluesMock: vi.fn(),
  useUpdateConfigJsonMock: vi.fn(),
  useMediaListMock: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError },
}));

vi.mock('@/features/editor/api', () => ({
  useEditorCharacters: () => useEditorCharactersMock(),
  useEditorMaps: () => useEditorMapsMock(),
  useCreateMap: () => useCreateMapMock(),
  useDeleteMap: () => useDeleteMapMock(),
  useUpdateMap: () => useUpdateMapMock(),
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

vi.mock('@/features/editor/mediaApi', () => ({
  useMediaList: () => useMediaListMock(),
}));

vi.mock('@/features/editor/flowApi', () => ({
  useFlowGraph: () => ({
    data: {
      nodes: [
        { id: 'scene-1', type: 'phase', data: { label: '조사 장면' } },
        { id: 'ending-1', type: 'ending', data: { label: '진엔딩' } },
      ],
    },
  }),
}));

vi.mock('@/features/editor/components/media/MediaPicker', () => ({
  MediaPicker: ({
    open,
    filterType,
    selectedId,
    onSelect,
  }: {
    open: boolean;
    filterType?: string;
    selectedId?: string | null;
    onSelect: (media: { id: string; name: string; type: string }) => void;
  }) =>
    open ? (
      <div>
        <span>filter:{filterType}</span>
        <span>selected:{selectedId ?? 'none'}</span>
        <button
          type="button"
          onClick={() => onSelect({ id: 'image-1', name: '저택 사진', type: 'IMAGE' })}
        >
          저택 사진 선택
        </button>
      </div>
    ) : null,
}));

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

import { LocationsSubTab } from '../LocationsSubTab';
import type { EditorThemeResponse } from '@/features/editor/api';
import {
  mockCharacters as fixtureCharacters,
  mockClues as fixtureClues,
  mockLocations as fixtureLocations,
  mockMaps as fixtureMaps,
  mockTheme as fixtureTheme,
} from './locationsSubTabTestData';

export { baseLocation, mockLocations, mockMaps, mockTheme } from './locationsSubTabTestData';

export {
  mutateMock,
  toastError,
  toastSuccess,
  updateConfigMutateMock,
  updateLocationMutateMock,
  useCreateLocationMock,
  useCreateMapMock,
  useDeleteLocationMock,
  useDeleteMapMock,
  useEditorCharactersMock,
  useEditorCluesMock,
  useEditorLocationsMock,
  useEditorMapsMock,
  useMediaListMock,
  useUpdateConfigJsonMock,
  useUpdateLocationMock,
  useUpdateMapMock,
};

export function defaultMutation() {
  return { mutate: mutateMock, isPending: false };
}

export function setupDefaultMocks() {
  useEditorCharactersMock.mockReturnValue({ data: fixtureCharacters, isLoading: false });
  useEditorMapsMock.mockReturnValue({ data: fixtureMaps, isLoading: false });
  useEditorLocationsMock.mockReturnValue({ data: fixtureLocations, isLoading: false });
  useCreateMapMock.mockReturnValue(defaultMutation());
  useDeleteMapMock.mockReturnValue(defaultMutation());
  useUpdateMapMock.mockReturnValue(defaultMutation());
  useCreateLocationMock.mockReturnValue(defaultMutation());
  useDeleteLocationMock.mockReturnValue(defaultMutation());
  useUpdateLocationMock.mockReturnValue({
    mutate: updateLocationMutateMock,
    isPending: false,
  });
  useEditorCluesMock.mockReturnValue({ data: fixtureClues, isLoading: false });
  useUpdateConfigJsonMock.mockReturnValue({
    mutate: updateConfigMutateMock,
    isPending: false,
  });
  useMediaListMock.mockReturnValue({
    data: [{ id: 'image-1', name: '저택 사진', type: 'IMAGE' }],
    isLoading: false,
  });
}

export function renderLocationsSubTab(theme: EditorThemeResponse = fixtureTheme as EditorThemeResponse) {
  return render(<LocationsSubTab themeId="theme-1" theme={theme} />);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
