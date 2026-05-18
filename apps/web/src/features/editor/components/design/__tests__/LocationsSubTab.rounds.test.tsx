import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import {
  mockLocations,
  renderLocationsSubTab,
  setupDefaultMocks,
  updateLocationMutateMock,
  useEditorLocationsMock,
} from './locationsSubTabTestUtils';

describe('LocationsSubTab 장면 공개 시점', () => {
  beforeEach(setupDefaultMocks);

  it('장소 공개 장면 선택지를 표시한다', () => {
    renderLocationsSubTab();
    expect(screen.getByText('공개 장면')).toBeDefined();
    expect(screen.getAllByText('처음부터 끝까지').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('거실 출현 장면')).toBeDefined();
    expect(screen.getByLabelText('거실 숨김 장면')).toBeDefined();
    expect(screen.getAllByText('조사 장면 (장면)').length).toBeGreaterThan(0);
    expect(screen.queryByText('토론 장면 (장면)')).toBeNull();
    expect(screen.queryByText('진엔딩 (결말)')).toBeNull();
  });

  it('출현 장면을 선택하면 useUpdateLocation.mutate 가 호출된다', () => {
    renderLocationsSubTab();
    updateLocationMutateMock.mockClear();
    fireEvent.change(screen.getByLabelText('거실 출현 장면'), { target: { value: 'scene-1' } });
    expect(updateLocationMutateMock).toHaveBeenCalledOnce();
    const [payload] = updateLocationMutateMock.mock.calls[0] as [
      { locationId: string; body: Record<string, unknown> },
    ];
    expect(payload.locationId).toBe('loc-1');
    expect(payload.body.appearance_scene_id).toBe('scene-1');
    expect(payload.body.hide_scene_id).toBeNull();
    expect(payload.body.name).toBe('거실');
  });

  it('숨김 장면을 선택하면 기존 출현 장면과 함께 저장한다', () => {
    useEditorLocationsMock.mockReturnValue({
      data: [
        { ...mockLocations[0], appearance_scene_id: 'scene-1', hide_scene_id: null },
        ...mockLocations.slice(1),
      ],
      isLoading: false,
    });
    renderLocationsSubTab();
    updateLocationMutateMock.mockClear();
    fireEvent.change(screen.getByLabelText('거실 숨김 장면'), { target: { value: 'scene-1' } });
    expect(updateLocationMutateMock).toHaveBeenCalledOnce();
    const [payload] = updateLocationMutateMock.mock.calls[0] as [
      { body: Record<string, unknown> },
    ];
    expect(payload.body.appearance_scene_id).toBe('scene-1');
    expect(payload.body.hide_scene_id).toBe('scene-1');
  });
});
