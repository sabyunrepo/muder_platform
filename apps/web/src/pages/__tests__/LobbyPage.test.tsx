import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { useAuthStore } from '@/stores/authStore';

const { navigateMock, useThemesMock, useRoomsMock, useJoinRoomMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  useThemesMock: vi.fn(),
  useRoomsMock: vi.fn(),
  useJoinRoomMock: vi.fn(),
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/features/lobby/api', () => ({
  useThemes: () => useThemesMock(),
  useRooms: () => useRoomsMock(),
  useJoinRoom: () => useJoinRoomMock(),
  useCreateRoom: () => ({ mutate: vi.fn(), isPending: false }),
  useRoomByCode: () => ({ data: undefined, isLoading: false, isError: false }),
}));

import LobbyPage from '../LobbyPage';

const mockThemes = [
  {
    id: 'theme-1',
    title: '초대받지 않은 손님',
    slug: 'uninvited-guest',
    description: '저택에서 벌어진 미스터리',
    min_players: 4,
    max_players: 6,
    duration_min: 90,
    cover_image: null,
    coin_price: 0,
  },
];

const mockRooms = [
  {
    id: 'room-1',
    code: 'ABC123',
    theme_id: 'theme-1',
    theme_title: '초대받지 않은 손님',
    host_id: 'host-1',
    host_nickname: '호스트',
    status: 'waiting',
    player_count: 1,
    max_players: 6,
    is_private: false,
    created_at: '2026-05-19T00:00:00Z',
  },
];

function renderLobby() {
  return render(
    <MemoryRouter>
      <LobbyPage />
    </MemoryRouter>,
  );
}

function mockLobbyData(joinMutate = vi.fn()) {
  useThemesMock.mockReturnValue({
    data: mockThemes,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  useRoomsMock.mockReturnValue({
    data: mockRooms,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  useJoinRoomMock.mockReturnValue({
    mutate: joinMutate,
    isPending: false,
    variables: undefined,
  });
  return joinMutate;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: false,
  });
});

describe('LobbyPage lazy-auth gates', () => {
  it('비로그인 사용자의 방 생성, 코드 참가, 테마 선택 액션을 로그인으로 보낸다', () => {
    mockLobbyData();

    renderLobby();

    fireEvent.click(screen.getByRole('button', { name: /방 만들기/ }));
    fireEvent.click(screen.getByRole('button', { name: /코드로 참가/ }));
    fireEvent.click(screen.getAllByText('초대받지 않은 손님')[0]);

    expect(navigateMock).toHaveBeenCalledTimes(3);
    expect(navigateMock).toHaveBeenNthCalledWith(1, '/login');
    expect(navigateMock).toHaveBeenNthCalledWith(2, '/login');
    expect(navigateMock).toHaveBeenNthCalledWith(3, '/login');
  });

  it('비로그인 사용자의 공개 방 참가 액션은 join mutation 대신 로그인으로 보낸다', () => {
    const joinMutate = mockLobbyData();

    renderLobby();

    fireEvent.click(screen.getByRole('button', { name: '참가' }));

    expect(joinMutate).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/login');
  });

  it('인증 초기화 중에는 로비 write 액션을 실행하지 않는다', () => {
    const joinMutate = mockLobbyData();
    useAuthStore.setState({ isAuthenticated: false, isLoading: true });

    renderLobby();

    expect(screen.getByRole('button', { name: /방 만들기/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /코드로 참가/ })).toBeDisabled();

    fireEvent.click(screen.getAllByText('초대받지 않은 손님')[0]);
    fireEvent.click(screen.getByRole('button', { name: '참가' }));

    expect(joinMutate).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
