import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { LogOut, Shield, Users, MessageSquare } from 'lucide-react';

import {
  useRoom,
  useLeaveRoom,
  useSelectRoomCharacter,
  useSetReady,
  useStartRoom,
  useThemeCharacters,
} from '@/features/lobby/api';
import { WsEventType } from '@mmp/shared';
import { useWsClient } from '@/hooks/useWsClient';
import { useWsEvent } from '@/hooks/useWsEvent';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { Alert, Button, LoadingState, PageShell } from '@/shared/components/ui';
import {
  PlayerList,
  RoomHeader,
  HostControls,
  RoomChat,
  CharacterSelectionPanel,
} from '@/features/room/components';

// ---------------------------------------------------------------------------
// WS 이벤트 페이로드 타입 (인라인)
// ---------------------------------------------------------------------------

interface PlayerJoinedPayload {
  player_id: string;
  user_id: string;
  nickname: string;
  avatar_url: string | null;
}

interface PlayerLeftPayload {
  player_id: string;
}

interface SessionStatePayload {
  status: string;
  players: Array<{
    id: string;
    user_id: string;
    nickname: string;
    avatar_url: string | null;
    is_host: boolean;
    is_ready: boolean;
    character_id?: string | null;
    joined_at: string;
  }>;
}

// ---------------------------------------------------------------------------
// 모바일 탭
// ---------------------------------------------------------------------------

type MobileTab = 'players' | 'chat';

// ---------------------------------------------------------------------------
// RoomPage
// ---------------------------------------------------------------------------

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore(selectUser);

  // 방 정보 쿼리
  const { data: room, isLoading, isError, refetch } = useRoom(id ?? '');

  // WS 연결
  const { send } = useWsClient({
    endpoint: 'game',
    sessionId: id,
    autoConnect: !!id,
  });

  // 방 나가기
  const leaveRoom = useLeaveRoom();
  const themeCharacters = useThemeCharacters(room?.theme_id ?? '');
  const selectRoomCharacter = useSelectRoomCharacter();
  const setReady = useSetReady();
  const startRoom = useStartRoom();

  // 로컬 상태
  const [mobileTab, setMobileTab] = useState<MobileTab>('players');
  const [startErrorMessage, setStartErrorMessage] = useState<string | null>(null);

  // ------ WS 이벤트 구독 → 쿼리 갱신 ------

  useWsEvent<PlayerJoinedPayload>('game', WsEventType.PLAYER_JOINED, () => {
    refetch();
  });

  useWsEvent<PlayerLeftPayload>('game', WsEventType.PLAYER_LEFT, () => {
    refetch();
  });

  useWsEvent<SessionStatePayload>('game', WsEventType.SESSION_STATE, () => {
    refetch();
  });

  // ------ 파생 상태 ------

  const players = useMemo(() => room?.players ?? [], [room?.players]);
  const currentPlayer = currentUser
    ? players.find((player) => player.user_id === currentUser.id)
    : undefined;
  const isReady = currentPlayer?.is_ready ?? false;
  const isHost = currentUser ? room?.host_id === currentUser.id : false;
  const nonHostPlayers = players.filter((p) => !p.is_host);
  const allReady = nonHostPlayers.length > 0 && nonHostPlayers.every((p) => p.is_ready);
  const minPlayers = room?.theme?.min_players;
  const hasMinPlayers = minPlayers != null && players.length >= minPlayers;
  const allCharactersSelected =
    players.length > 0 && players.every((player) => Boolean(player.character_id));
  const characterNameById = useMemo(
    () => new Map((themeCharacters.data ?? []).map((character) => [character.id, character.name])),
    [themeCharacters.data]
  );
  const selectedByOtherPlayerIds = useMemo(
    () =>
      new Set(
        players
          .filter((player) => player.user_id !== currentUser?.id)
          .map((player) => player.character_id)
          .filter((characterId): characterId is string => Boolean(characterId))
      ),
    [currentUser?.id, players]
  );

  // ------ 핸들러 ------

  const handleLeave = useCallback(() => {
    if (!id) return;
    leaveRoom.mutate(id, {
      onSuccess: () => navigate('/lobby'),
    });
  }, [id, leaveRoom, navigate]);

  const handleToggleReady = useCallback(() => {
    if (!id) return;
    setReady.mutate(
      { roomId: id, is_ready: !isReady },
      {
        onSuccess: () => {
          refetch();
        },
      }
    );
  }, [id, isReady, refetch, setReady]);

  const handleSelectCharacter = useCallback(
    (characterId: string) => {
      if (!id) return;
      selectRoomCharacter.mutate(
        { roomId: id, characterId },
        {
          onSuccess: () => {
            refetch();
          },
        }
      );
    },
    [id, refetch, selectRoomCharacter]
  );

  const handleStartGame = useCallback(() => {
    if (!id) return;
    setStartErrorMessage(null);
    startRoom.mutate(id, {
      onSuccess: () => {
        navigate(`/game/${id}`);
      },
      onError: (error) => {
        const reason = error instanceof Error ? error.message : '알 수 없는 오류';
        setStartErrorMessage(`게임 시작에 실패했습니다. ${reason}`);
      },
    });
  }, [id, navigate, startRoom]);

  const handleCloseRoom = useCallback(() => {
    send(WsEventType.GAME_ACTION, { type: 'close' });
    navigate('/lobby');
  }, [send, navigate]);

  // ------ 로딩 / 에러 ------

  if (isLoading) {
    return (
      <PageShell>
        <LoadingState label="방 정보를 불러오는 중" />
      </PageShell>
    );
  }

  if (isError || !room) {
    return (
      <PageShell>
        <Alert tone="error" title="방 정보를 불러올 수 없습니다">
          <div className="mt-3">
            <Button variant="secondary" onClick={() => navigate('/lobby')}>
              로비로 돌아가기
            </Button>
          </div>
        </Alert>
      </PageShell>
    );
  }

  // ------ 렌더링 ------

  return (
    <PageShell className="min-h-[calc(100vh-4rem)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        {/* 헤더 */}
        <RoomHeader
          themeTitle={room.theme_title ?? room.theme?.title ?? '대기방'}
          roomCode={room.code}
          playerCount={room.player_count}
          maxPlayers={room.max_players}
          status={room.status}
        />

        {/* 모바일 탭 전환 */}
        <div className="flex gap-2 md:hidden">
          <Button
            variant={mobileTab === 'players' ? 'primary' : 'ghost'}
            size="sm"
            leftIcon={<Users className="h-4 w-4" />}
            onClick={() => setMobileTab('players')}
            className="flex-1"
          >
            참가자
          </Button>
          <Button
            variant={mobileTab === 'chat' ? 'primary' : 'ghost'}
            size="sm"
            leftIcon={<MessageSquare className="h-4 w-4" />}
            onClick={() => setMobileTab('chat')}
            className="flex-1"
          >
            채팅
          </Button>
        </div>

        {/* 2컬럼 레이아웃 (데스크탑) / 탭 전환 (모바일) */}
        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          {/* 왼쪽: 참가자 + 호스트 컨트롤 */}
          <div
            className={`flex flex-col gap-4 ${mobileTab !== 'players' ? 'hidden md:flex' : 'flex'}`}
          >
            <PlayerList
              players={players}
              maxPlayers={room.max_players}
              characterNameById={characterNameById}
            />
            {currentPlayer && (
              <CharacterSelectionPanel
                characters={themeCharacters.data ?? []}
                selectedCharacterId={currentPlayer.character_id}
                selectedByOtherPlayerIds={selectedByOtherPlayerIds}
                isLoading={themeCharacters.isLoading}
                isError={themeCharacters.isError}
                isSelecting={selectRoomCharacter.isPending}
                onSelect={handleSelectCharacter}
              />
            )}
            <HostControls
              isHost={isHost}
              allReady={allReady}
              hasMinPlayers={hasMinPlayers}
              allCharactersSelected={allCharactersSelected}
              onStartGame={handleStartGame}
              onCloseRoom={handleCloseRoom}
              isStarting={startRoom.isPending}
              startErrorMessage={startErrorMessage}
            />
          </div>

          {/* 오른쪽: 채팅 */}
          <div
            className={`h-[400px] md:h-[500px] ${
              mobileTab !== 'chat' ? 'hidden md:block' : 'block'
            }`}
          >
            <RoomChat roomId={id} send={send} />
          </div>
        </div>

        {/* 하단: 레디 + 나가기 */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--mmp-color-hairline)] pt-4">
          <Button
            variant="ghost"
            leftIcon={<LogOut className="h-4 w-4" />}
            onClick={handleLeave}
            isLoading={leaveRoom.isPending}
          >
            나가기
          </Button>

          {!isHost && (
            <Button
              variant={isReady ? 'secondary' : 'primary'}
              leftIcon={<Shield className="h-4 w-4" />}
              onClick={handleToggleReady}
              isLoading={setReady.isPending}
            >
              {isReady ? '준비 취소' : '준비 완료'}
            </Button>
          )}
        </div>
      </div>
    </PageShell>
  );
}
