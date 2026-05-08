import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import {
  mockLocations,
  mockMaps,
  mutateMock,
  renderLocationsSubTab,
  setupDefaultMocks,
  updateLocationMutateMock,
  useEditorLocationsMock,
  useEditorMapsMock,
} from './locationsSubTabTestUtils';

describe('LocationsSubTab 장소 이미지 미디어 참조', () => {
  beforeEach(setupDefaultMocks);

  it('IMAGE 미디어를 지도 이미지 참조로 저장한다', () => {
    renderLocationsSubTab();

    fireEvent.click(screen.getByText('미디어에서 지도 선택'));
    expect(screen.getByText('filter:IMAGE')).toBeDefined();
    fireEvent.click(screen.getByText('저택 사진 선택'));

    expect(mutateMock).toHaveBeenCalledOnce();
    const [payload] = mutateMock.mock.calls[0] as [
      { mapId: string; body: Record<string, unknown> },
    ];
    expect(payload.mapId).toBe('map-1');
    expect(payload.body.image_media_id).toBe('image-1');
    expect(payload.body.image_url).toBeNull();
    expect(payload.body.name).toBe('저택 1층');
  });

  it('선택된 지도 이미지 참조를 제거할 수 있다', () => {
    useEditorMapsMock.mockReturnValue({
      data: [{ ...mockMaps[0], image_media_id: 'image-1' }, ...mockMaps.slice(1)],
      isLoading: false,
    });

    renderLocationsSubTab();

    expect(screen.getByText('저택 사진')).toBeDefined();
    fireEvent.click(screen.getAllByText('제거')[0]);

    expect(mutateMock).toHaveBeenCalledOnce();
    const [payload] = mutateMock.mock.calls[0] as [
      { mapId: string; body: Record<string, unknown> },
    ];
    expect(payload.mapId).toBe('map-1');
    expect(payload.body.image_media_id).toBeNull();
  });

  it('IMAGE 미디어만 선택해 장소 이미지 참조로 저장한다', () => {
    renderLocationsSubTab();

    fireEvent.click(screen.getByText('미디어 이미지 선택'));
    expect(screen.getByText('filter:IMAGE')).toBeDefined();
    fireEvent.click(screen.getByText('저택 사진 선택'));

    expect(updateLocationMutateMock).toHaveBeenCalledOnce();
    const [payload] = updateLocationMutateMock.mock.calls[0] as [
      { locationId: string; body: Record<string, unknown> },
    ];
    expect(payload.locationId).toBe('loc-1');
    expect(payload.body.image_media_id).toBe('image-1');
    expect(payload.body.image_url).toBeNull();
  });

  it('선택된 장소 이미지 참조를 제거할 수 있다', () => {
    useEditorLocationsMock.mockReturnValue({
      data: [{ ...mockLocations[0], image_media_id: 'image-1' }, ...mockLocations.slice(1)],
      isLoading: false,
    });

    renderLocationsSubTab();

    expect(screen.getByText('저택 사진')).toBeDefined();
    fireEvent.click(screen.getByText('제거'));

    expect(updateLocationMutateMock).toHaveBeenCalledOnce();
    const [payload] = updateLocationMutateMock.mock.calls[0] as [
      { body: Record<string, unknown> },
    ];
    expect(payload.body.image_media_id).toBeNull();
  });
});
