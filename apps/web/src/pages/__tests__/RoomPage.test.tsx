import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { useAuthStore } from '@/stores/authStore';

const {
  navigateMock,
  refetchMock,
  sendMock,
  useRoomMock,
  useInviteRoomFriendsMock,
  useLeaveRoomMock,
  useSelectRoomCharacterMock,
  useSetReadyMock,
  useStartRoomMock,
  useThemeCharactersMock,
  useVoiceConnectionMock,
  useWsEventMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  refetchMock: vi.fn(),
  sendMock: vi.fn(),
  useRoomMock: vi.fn(),
  useInviteRoomFriendsMock: vi.fn(),
  useLeaveRoomMock: vi.fn(),
  useSelectRoomCharacterMock: vi.fn(),
  useSetReadyMock: vi.fn(),
  useStartRoomMock: vi.fn(),
  useThemeCharactersMock: vi.fn(),
  useVoiceConnectionMock: vi.fn(),
  useWsEventMock: vi.fn(),
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ id: 'room-1' }),
  };
});

vi.mock('@/features/lobby/api', () => ({
  useRoom: () => useRoomMock(),
  useInviteRoomFriends: () => useInviteRoomFriendsMock(),
  useLeaveRoom: () => useLeaveRoomMock(),
  useSelectRoomCharacter: () => useSelectRoomCharacterMock(),
  useSetReady: () => useSetReadyMock(),
  useStartRoom: () => useStartRoomMock(),
  useThemeCharacters: (themeId: string) => useThemeCharactersMock(themeId),
}));

vi.mock('@/features/social/api', () => ({
  useFriends: () => ({
    data: [
      {
        id: 'friend-1',
        nickname: '민재',
        avatar_url: null,
        role: 'user',
        friendship_id: 'friendship-1',
        since: '2026-05-19T00:00:00Z',
      },
      {
        id: 'friend-2',
        nickname: '하윤',
        avatar_url: null,
        role: 'user',
        friendship_id: 'friendship-2',
        since: '2026-05-19T00:00:00Z',
      },
    ],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('@/hooks/useWsClient', () => ({
  useWsClient: () => ({ send: sendMock }),
}));

vi.mock('@/hooks/useWsEvent', () => ({
  useWsEvent: (...args: unknown[]) => useWsEventMock(...args),
}));

vi.mock('@/hooks/useVoiceConnection', () => ({
  useVoiceConnection: (options: unknown) => useVoiceConnectionMock(options),
}));

import RoomPage from '../RoomPage';

const baseRoom = {
  id: 'room-1',
  code: 'ABC123',
  theme_id: 'theme-1',
  theme_title: '초대받지 않은 손님',
  host_id: 'host-1',
  host_nickname: '호스트',
  status: 'WAITING',
  player_count: 2,
  max_players: 6,
  is_private: false,
  created_at: '2026-05-19T00:00:00Z',
  theme: {
    id: 'theme-1',
    title: '초대받지 않은 손님',
    slug: 'uninvited-guest',
    description: '저택에서 벌어진 미스터리',
    min_players: 2,
    max_players: 6,
    duration_min: 90,
    cover_image: null,
    coin_price: 0,
  },
  players: [
    {
      id: 'player-host',
      user_id: 'host-1',
      nickname: '호스트',
      avatar_url: null,
      is_host: true,
      is_ready: true,
      character_id: 'character-detective',
      joined_at: '2026-05-19T00:00:00Z',
    },
    {
      id: 'player-user',
      user_id: 'user-1',
      nickname: '참가자',
      avatar_url: null,
      is_host: false,
      is_ready: true,
      character_id: 'character-doctor',
      joined_at: '2026-05-19T00:00:00Z',
    },
  ],
};

const baseCharacters = [
  {
    id: 'character-detective',
    name: '탐정',
    description: '사건의 진실을 좇는 손님',
    image_url: null,
    image_media_id: null,
    sort_order: 1,
  },
  {
    id: 'character-doctor',
    name: '의사',
    description: '저택의 비밀을 알고 있는 인물',
    image_url: null,
    image_media_id: null,
    sort_order: 2,
  },
  {
    id: 'character-chef',
    name: '요리사',
    description: '마지막 만찬을 준비한 사람',
    image_url: null,
    image_media_id: null,
    sort_order: 3,
  },
];

function renderRoom() {
  return render(
    <MemoryRouter>
      <RoomPage />
    </MemoryRouter>
  );
}

function mockRoomPage(
  overrides: {
    room?: typeof baseRoom;
    readyMutate?: ReturnType<typeof vi.fn>;
    selectMutate?: ReturnType<typeof vi.fn>;
    startMutate?: ReturnType<typeof vi.fn>;
    leaveMutate?: ReturnType<typeof vi.fn>;
    inviteMutate?: ReturnType<typeof vi.fn>;
    inviteData?: unknown;
    invitePending?: boolean;
    readyPending?: boolean;
    startPending?: boolean;
  } = {}
) {
  useRoomMock.mockReturnValue({
    data: overrides.room ?? baseRoom,
    isLoading: false,
    isError: false,
    refetch: refetchMock,
  });
  useLeaveRoomMock.mockReturnValue({
    mutate: overrides.leaveMutate ?? vi.fn(),
    isPending: false,
  });
  useInviteRoomFriendsMock.mockReturnValue({
    mutate: overrides.inviteMutate ?? vi.fn(),
    data: overrides.inviteData,
    isPending: overrides.invitePending ?? false,
  });
  useThemeCharactersMock.mockReturnValue({
    data: baseCharacters,
    isLoading: false,
    isError: false,
  });
  useSelectRoomCharacterMock.mockReturnValue({
    mutate: overrides.selectMutate ?? vi.fn(),
    isPending: false,
  });
  useSetReadyMock.mockReturnValue({
    mutate: overrides.readyMutate ?? vi.fn(),
    isPending: overrides.readyPending ?? false,
  });
  useStartRoomMock.mockReturnValue({
    mutate: overrides.startMutate ?? vi.fn(),
    isPending: overrides.startPending ?? false,
  });
  useVoiceConnectionMock.mockReturnValue({
    participants: [],
    localParticipant: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    toggleMute: vi.fn(),
    toggleSpeakerMute: vi.fn(),
  });
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

describe('RoomPage pregame controls', () => {
  it('데스크톱 대기방을 참가자 상태, 준비 설정, 채팅과 음성 영역으로 나눈다', () => {
    useAuthStore.setState({
      user: { id: 'user-1', email: 'user@example.com', nickname: '참가자', role: 'user' },
      isAuthenticated: true,
    });
    mockRoomPage();

    renderRoom();

    expect(screen.getByRole('heading', { name: '참가자 상태' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '준비 설정' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '채팅과 음성' })).toBeInTheDocument();
    expect(screen.getByText('준비 상태와 캐릭터 선택을 한 번에 확인합니다.')).toBeInTheDocument();
    expect(screen.getAllByText('2/6').length).toBeGreaterThan(0);
    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(screen.getAllByText('준비 완료').length).toBeGreaterThan(0);
  });

  it('현재 사용자의 준비 상태를 room.players에서 읽고 HTTP ready mutation에 is_ready를 보낸다', async () => {
    const readyMutate = vi.fn((_variables, options) => {
      options?.onSuccess?.();
    });
    useAuthStore.setState({
      user: { id: 'user-1', email: 'user@example.com', nickname: '참가자', role: 'user' },
      isAuthenticated: true,
    });
    mockRoomPage({ readyMutate });

    renderRoom();

    const readyButton = screen.getByRole('button', { name: /준비 취소/ });
    fireEvent.click(readyButton);

    expect(readyMutate).toHaveBeenCalledWith(
      { roomId: 'room-1', is_ready: false },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    await waitFor(() => expect(refetchMock).toHaveBeenCalled());
  });

  it('ready mutation 중에는 준비 버튼을 비활성화한다', () => {
    useAuthStore.setState({
      user: { id: 'user-1', email: 'user@example.com', nickname: '참가자', role: 'user' },
      isAuthenticated: true,
    });
    mockRoomPage({
      room: {
        ...baseRoom,
        players: baseRoom.players.map((player) =>
          player.user_id === 'user-1' ? { ...player, is_ready: false } : player
        ),
      },
      readyPending: true,
    });

    renderRoom();

    expect(screen.getByRole('button', { name: /준비 완료/ })).toBeDisabled();
  });

  it('호스트가 게임 시작에 성공하면 game route로 이동한다', () => {
    const startMutate = vi.fn((_roomId, options) => {
      options?.onSuccess?.();
    });
    useAuthStore.setState({
      user: { id: 'host-1', email: 'host@example.com', nickname: '호스트', role: 'user' },
      isAuthenticated: true,
    });
    mockRoomPage({ startMutate });

    renderRoom();

    fireEvent.click(screen.getByRole('button', { name: /게임 시작/ }));

    expect(startMutate).toHaveBeenCalledWith(
      'room-1',
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
    );
    expect(navigateMock).toHaveBeenCalledWith('/game/room-1');
  });

  it('대기방 헤더에서 uppercase WAITING 상태를 대기 중으로 표시한다', () => {
    useAuthStore.setState({
      user: { id: 'user-1', email: 'user@example.com', nickname: '참가자', role: 'user' },
      isAuthenticated: true,
    });
    mockRoomPage();

    renderRoom();

    expect(screen.getByText('대기 중')).toBeInTheDocument();
  });

  it('theme 객체가 없는 실제 방 상세 응답도 대기방으로 렌더링한다', () => {
    useAuthStore.setState({
      user: { id: 'user-1', email: 'user@example.com', nickname: '참가자', role: 'user' },
      isAuthenticated: true,
    });
    const roomWithoutTheme = { ...baseRoom } as Partial<typeof baseRoom>;
    delete roomWithoutTheme.theme;
    delete roomWithoutTheme.theme_title;
    delete roomWithoutTheme.host_nickname;
    mockRoomPage({ room: roomWithoutTheme as typeof baseRoom });

    renderRoom();

    expect(screen.getByRole('heading', { name: '대기방' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /준비 취소/ })).toBeInTheDocument();
  });

  it('호스트도 theme 최소 인원 정보가 없으면 게임 시작을 서버에 요청하지 않는다', () => {
    const startMutate = vi.fn();
    useAuthStore.setState({
      user: { id: 'host-1', email: 'host@example.com', nickname: '호스트', role: 'user' },
      isAuthenticated: true,
    });
    const roomWithoutTheme = { ...baseRoom } as Partial<typeof baseRoom>;
    delete roomWithoutTheme.theme;
    mockRoomPage({ room: roomWithoutTheme as typeof baseRoom, startMutate });

    renderRoom();

    const startButton = screen.getByRole('button', { name: /게임 시작/ });
    expect(startButton).toBeDisabled();
    expect(screen.getByText('최소 인원이 충족되지 않았습니다.')).toBeInTheDocument();

    fireEvent.click(startButton);

    expect(startMutate).not.toHaveBeenCalled();
  });

  it('기존 채팅 탭과 나가기 동작을 유지한다', () => {
    const leaveMutate = vi.fn((_roomId, options) => {
      options?.onSuccess?.();
    });
    useAuthStore.setState({
      user: { id: 'user-1', email: 'user@example.com', nickname: '참가자', role: 'user' },
      isAuthenticated: true,
    });
    mockRoomPage({ leaveMutate });

    renderRoom();

    expect(screen.getByRole('button', { name: /채팅/ })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('메시지를 입력하세요...'), {
      target: { value: '준비됐어요' },
    });
    fireEvent.click(screen.getByRole('button', { name: /메시지 전송/ }));
    fireEvent.click(screen.getByRole('button', { name: /나가기/ }));

    expect(sendMock).toHaveBeenCalledWith('chat:send', { room_id: 'room-1', text: '준비됐어요' });
    expect(leaveMutate).toHaveBeenCalledWith(
      'room-1',
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    expect(navigateMock).toHaveBeenCalledWith('/lobby');
  });

  it('호스트 게임 시작 실패 사유를 컨트롤 근처에 표시한다', () => {
    const startMutate = vi.fn((_roomId, options) => {
      options?.onError?.(new Error('아직 모든 참가자가 준비하지 않았습니다.'));
    });
    useAuthStore.setState({
      user: { id: 'host-1', email: 'host@example.com', nickname: '호스트', role: 'user' },
      isAuthenticated: true,
    });
    mockRoomPage({ startMutate });

    renderRoom();

    fireEvent.click(screen.getByRole('button', { name: /게임 시작/ }));

    expect(screen.getByText(/게임 시작에 실패했습니다/)).toHaveTextContent(
      '아직 모든 참가자가 준비하지 않았습니다.'
    );
  });

  it('대기방에서 테마 캐릭터 목록을 표시하고 현재 선택을 구분한다', () => {
    useAuthStore.setState({
      user: { id: 'user-1', email: 'user@example.com', nickname: '참가자', role: 'user' },
      isAuthenticated: true,
    });
    mockRoomPage();

    renderRoom();

    expect(useThemeCharactersMock).toHaveBeenCalledWith('theme-1');
    expect(screen.getByRole('heading', { name: '캐릭터 선택' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /의사/ })).toHaveTextContent('선택됨');
    expect(screen.getByRole('button', { name: /요리사/ })).toBeEnabled();
    expect(screen.getAllByText('참가자').length).toBeGreaterThan(0);
    expect(screen.getAllByText('의사').length).toBeGreaterThan(0);
  });

  it('다른 참가자가 선택한 캐릭터는 비활성화하고 내 선택 mutation을 보낸다', () => {
    const selectMutate = vi.fn((_variables, options) => {
      options?.onSuccess?.();
    });
    useAuthStore.setState({
      user: { id: 'user-1', email: 'user@example.com', nickname: '참가자', role: 'user' },
      isAuthenticated: true,
    });
    mockRoomPage({ selectMutate });

    renderRoom();

    expect(screen.getByRole('button', { name: /탐정/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /요리사/ }));

    expect(selectMutate).toHaveBeenCalledWith(
      { roomId: 'room-1', characterId: 'character-chef' },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    expect(refetchMock).toHaveBeenCalled();
  });

  it('캐릭터를 선택하지 않은 참가자가 있으면 호스트 시작 버튼을 비활성화하고 사유를 표시한다', () => {
    const startMutate = vi.fn();
    useAuthStore.setState({
      user: { id: 'host-1', email: 'host@example.com', nickname: '호스트', role: 'user' },
      isAuthenticated: true,
    });
    mockRoomPage({
      room: {
        ...baseRoom,
        players: baseRoom.players.map((player) =>
          player.user_id === 'user-1' ? { ...player, character_id: null } : player
        ),
      },
      startMutate,
    });

    renderRoom();

    const startButton = screen.getByRole('button', { name: /게임 시작/ });
    expect(startButton).toBeDisabled();
    expect(
      screen.getByText('모든 참가자가 캐릭터를 선택해야 시작할 수 있습니다.')
    ).toBeInTheDocument();

    fireEvent.click(startButton);

    expect(startMutate).not.toHaveBeenCalled();
  });

  it('호스트는 대기방에서 친구를 선택해 방 초대를 보낼 수 있다', () => {
    const inviteMutate = vi.fn();
    useAuthStore.setState({
      user: { id: 'host-1', email: 'host@example.com', nickname: '호스트', role: 'user' },
      isAuthenticated: true,
    });
    mockRoomPage({ inviteMutate });

    renderRoom();

    fireEvent.click(screen.getByRole('checkbox', { name: /민재/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /하윤/ }));
    fireEvent.click(screen.getByRole('button', { name: /선택한 친구 초대/ }));

    expect(inviteMutate).toHaveBeenCalledWith({
      roomId: 'room-1',
      friend_ids: ['friend-1', 'friend-2'],
    });
  });

  it('초대 성공 후 전송/건너뜀 결과 수를 표시한다', () => {
    useAuthStore.setState({
      user: { id: 'host-1', email: 'host@example.com', nickname: '호스트', role: 'user' },
      isAuthenticated: true,
    });
    mockRoomPage({
      inviteData: {
        sent: [{ friend_id: 'friend-1', nickname: '민재', online: true }],
        skipped: [{ friend_id: 'friend-2', reason: 'already_in_room' }],
      },
    });

    renderRoom();

    expect(screen.getByText('초대 1명 전송, 1명 건너뜀')).toBeInTheDocument();
  });

  it('초대 응답의 sent/skipped가 null이어도 결과 영역이 깨지지 않는다', () => {
    useAuthStore.setState({
      user: { id: 'host-1', email: 'host@example.com', nickname: '호스트', role: 'user' },
      isAuthenticated: true,
    });
    mockRoomPage({
      inviteData: {
        sent: null,
        skipped: null,
      },
    });

    renderRoom();

    expect(screen.getByText('초대 0명 전송, 0명 건너뜀')).toBeInTheDocument();
  });

  it('대기방 음성 채팅 패널을 room_id 기반으로 연결한다', () => {
    const connect = vi.fn();
    useAuthStore.setState({
      user: { id: 'user-1', email: 'user@example.com', nickname: '참가자', role: 'user' },
      isAuthenticated: true,
    });
    mockRoomPage();
    useVoiceConnectionMock.mockReturnValue({
      participants: [],
      localParticipant: null,
      connect,
      disconnect: vi.fn(),
      toggleMute: vi.fn(),
      toggleSpeakerMute: vi.fn(),
    });

    renderRoom();

    expect(useVoiceConnectionMock).toHaveBeenCalledWith({
      roomId: 'room-1',
      roomType: 'main',
      autoConnect: false,
    });
    fireEvent.click(screen.getByRole('button', { name: '입장' }));
    expect(connect).toHaveBeenCalled();
  });
});
