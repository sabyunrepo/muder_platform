import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import {
  mockLocations,
  renderLocationsSubTab,
  setupDefaultMocks,
  toastError,
  updateLocationMutateMock,
  useEditorLocationsMock,
} from './locationsSubTabTestUtils';

describe('LocationsSubTab 라운드 공개 시점', () => {
  beforeEach(setupDefaultMocks);

  it('공개 시점을 제작자용 선택지로 표시한다', () => {
    renderLocationsSubTab();
    expect(screen.getByText('공개 시점')).toBeDefined();
    expect(screen.getAllByText('처음부터 끝까지').length).toBeGreaterThan(0);
    expect(screen.getByText('특정 라운드부터')).toBeDefined();
  });

  it('시작 라운드 값 입력 후 blur 하면 useUpdateLocation.mutate 가 호출된다', () => {
    renderLocationsSubTab();
    fireEvent.click(screen.getByText('특정 라운드부터'));
    updateLocationMutateMock.mockClear();
    const fromInput = screen.getByLabelText('거실 시작 라운드') as HTMLInputElement;
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
    renderLocationsSubTab();
    fireEvent.click(screen.getByText('특정 구간만'));
    updateLocationMutateMock.mockClear();
    const fromInput = screen.getByLabelText('거실 시작 라운드') as HTMLInputElement;
    const untilInput = screen.getByLabelText('거실 종료 라운드') as HTMLInputElement;
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
    renderLocationsSubTab();
    const fromInput = screen.getByLabelText('거실 시작 라운드') as HTMLInputElement;
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
