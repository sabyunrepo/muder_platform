import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import {
  mockLocations,
  renderLocationsSubTab,
  setupDefaultMocks,
  toastSuccess,
  updateConfigMutateMock,
  updateLocationMutateMock,
  useEditorLocationsMock,
} from './locationsSubTabTestUtils';

describe('LocationsSubTab 장소 기본 정보', () => {
  beforeEach(setupDefaultMocks);
  afterEach(() => {
    vi.useRealTimers();
  });

  async function flushLocationAutosave() {
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
  }

  it('공개 설명과 진입 메시지를 Location API payload로 자동저장한다', async () => {
    vi.useFakeTimers();
    useEditorLocationsMock.mockReturnValue({
      data: [{ ...mockLocations[0], name: '거실' }, ...mockLocations.slice(1)],
      isLoading: false,
    });

    renderLocationsSubTab();

    fireEvent.change(screen.getByLabelText('거실 장소 이름'), {
      target: { value: '응접실' },
    });
    fireEvent.change(screen.getByLabelText('거실 공개 설명'), {
      target: { value: '손님들이 모이는 공간' },
    });
    fireEvent.change(screen.getByLabelText('거실 진입 메시지'), {
      target: { value: '낡은 시계 소리가 들린다.' },
    });
    expect(screen.queryByRole('button', { name: /^저장$/ })).toBeNull();
    await flushLocationAutosave();

    expect(updateLocationMutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        locationId: 'loc-1',
        body: expect.objectContaining({
          name: '응접실',
          public_description: '손님들이 모이는 공간',
          entry_message: '낡은 시계 소리가 들린다.',
        }),
      }),
      expect.any(Object)
    );
    const [, updateLocationOptions] = updateLocationMutateMock.mock.calls[0] as [
      unknown,
      { onSuccess?: () => void },
    ];
    updateLocationOptions.onSuccess?.();
    expect(updateConfigMutateMock).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith(
      '장소 기본 정보가 저장되었습니다',
      expect.objectContaining({ id: 'location-basic-autosave-loc-1' })
    );
  });
});
