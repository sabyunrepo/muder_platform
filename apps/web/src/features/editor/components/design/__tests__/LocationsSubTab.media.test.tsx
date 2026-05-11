import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import {
  mockLocations,
  renderLocationsSubTab,
  setupDefaultMocks,
  updateLocationMutateMock,
  useEditorLocationsMock,
} from './locationsSubTabTestUtils';

describe('LocationsSubTab 장소 이미지 미디어 참조', () => {
  beforeEach(setupDefaultMocks);

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
