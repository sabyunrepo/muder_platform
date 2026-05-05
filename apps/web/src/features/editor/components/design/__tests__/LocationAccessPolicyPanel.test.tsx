import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LocationAccessPolicyPanel } from '../LocationAccessPolicyPanel';
import type { EditorCharacterResponse, LocationResponse } from '@/features/editor/api';

const { useEditorCharactersMock, useUpdateLocationMock, mutateMock, toastError } = vi.hoisted(
  () => ({
    useEditorCharactersMock: vi.fn(),
    useUpdateLocationMock: vi.fn(),
    mutateMock: vi.fn(),
    toastError: vi.fn(),
  }),
);

vi.mock('sonner', () => ({
  toast: { error: toastError },
}));

vi.mock('@/features/editor/api', () => ({
  useEditorCharacters: () => useEditorCharactersMock(),
  useUpdateLocation: () => useUpdateLocationMock(),
}));

const characters: EditorCharacterResponse[] = [
  {
    id: 'char-1',
    theme_id: 'theme-1',
    name: '김철수',
    description: null,
    image_url: null,
    is_culprit: false,
    mystery_role: 'suspect',
    sort_order: 0,
    is_playable: true,
    show_in_intro: true,
    can_speak_in_reading: true,
    is_voting_candidate: true,
  },
  {
    id: 'char-2',
    theme_id: 'theme-1',
    name: '이영희',
    description: null,
    image_url: null,
    is_culprit: false,
    mystery_role: 'detective',
    sort_order: 1,
    is_playable: true,
    show_in_intro: true,
    can_speak_in_reading: true,
    is_voting_candidate: false,
  },
];

const location: LocationResponse = {
  id: 'loc-1',
  theme_id: 'theme-1',
  map_id: 'map-1',
  name: '서재',
  description: '낡은 서재',
  restricted_characters: 'char-1',
  image_url: '/images/study.webp',
  from_round: 1,
  until_round: 3,
  sort_order: 7,
  created_at: '2026-05-02T00:00:00Z',
};

beforeEach(() => {
  useEditorCharactersMock.mockReturnValue({ data: characters, isLoading: false });
  useUpdateLocationMock.mockReturnValue({ mutate: mutateMock, isPending: false });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('LocationAccessPolicyPanel', () => {
  it('기존 restricted_characters CSV를 체크박스 상태로 표시한다', () => {
    render(<LocationAccessPolicyPanel themeId="theme-1" location={location} />);

    expect(screen.getByText('접근 제한')).toBeDefined();
    expect((screen.getByLabelText(/김철수/) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/이영희/) as HTMLInputElement).checked).toBe(false);
  });

  it('캐릭터를 제한 목록에 추가할 때 기존 장소 필드를 보존해 저장한다', () => {
    render(<LocationAccessPolicyPanel themeId="theme-1" location={location} />);

    fireEvent.click(screen.getByLabelText(/이영희/));

    expect(mutateMock).toHaveBeenCalledOnce();
    expect(mutateMock.mock.calls[0][0]).toEqual({
      locationId: 'loc-1',
      body: {
        name: '서재',
        restricted_characters: 'char-1,char-2',
        image_url: '/images/study.webp',
        sort_order: 7,
        from_round: 1,
        until_round: 3,
      },
    });
  });

  it('마지막 제한 캐릭터를 해제하면 null로 저장하고 실패 시 토스트를 띄운다', () => {
    mutateMock.mockImplementation((_body, options) => options?.onError?.(new Error('fail')));
    render(
      <LocationAccessPolicyPanel
        themeId="theme-1"
        location={{ ...location, restricted_characters: 'char-1' }}
      />,
    );

    fireEvent.click(screen.getByLabelText(/김철수/));

    expect(mutateMock.mock.calls[0][0].body.restricted_characters).toBeNull();
    expect(toastError).toHaveBeenCalledWith('접근 제한 저장에 실패했습니다');
  });

  it('캐릭터 로딩/빈 상태와 저장 중 disabled 상태를 보여준다', () => {
    useEditorCharactersMock.mockReturnValueOnce({ data: undefined, isLoading: true });
    const { rerender } = render(<LocationAccessPolicyPanel themeId="theme-1" location={location} />);
    expect(document.querySelector('.animate-spin')).toBeDefined();

    useEditorCharactersMock.mockReturnValueOnce({ data: [], isLoading: false });
    rerender(<LocationAccessPolicyPanel themeId="theme-1" location={location} />);
    expect(screen.getByText('캐릭터가 없습니다.')).toBeDefined();

    useEditorCharactersMock.mockReturnValueOnce({ data: characters, isLoading: false });
    useUpdateLocationMock.mockReturnValueOnce({ mutate: mutateMock, isPending: true });
    rerender(<LocationAccessPolicyPanel themeId="theme-1" location={location} />);
    expect((screen.getByLabelText(/김철수/) as HTMLInputElement).disabled).toBe(true);
  });
});
