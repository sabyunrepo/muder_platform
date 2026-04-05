import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { LogOut, Shield, Users, MessageSquare } from "lucide-react";

import { useRoom, useLeaveRoom } from "@/features/lobby/api";
import { WsEventType } from "@mmp/shared";
import { useWsClient } from "@/hooks/useWsClient";
import { useWsEvent } from "@/hooks/useWsEvent";
import { useAuthStore, selectUser } from "@/stores/authStore";
import { Button, Spinner } from "@/shared/components/ui";
import {
  PlayerList,
  RoomHeader,
  HostControls,
  RoomChat,
} from "@/features/room/components";

// ---------------------------------------------------------------------------
// WS 이벤트 페이로드 타입 (인라인)
// ---------------------------------------------------------------------------

interface PlayerJoinedPayload {
  player_id: string;
  user_id: string;
  nickname: string;
  profile_image: string | null;
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
    profile_image: string | null;
    is_host: boolean;
    is_ready: boolean;
    joined_at: string;
  }>;
}

// ---------------------------------------------------------------------------
// 모바일 탭
// ---------------------------------------------------------------------------

type MobileTab = "players" | "chat";

// ---------------------------------------------------------------------------
// RoomPage
// ---------------------------------------------------------------------------

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore(selectUser);

  // 방 정보 쿼리
  const { data: room, isLoading, isError, refetch } = useRoom(id ?? "");

  // WS 연결
  const { send } = useWsClient({
    endpoint: "game",
    sessionId: id,
    autoConnect: !!id,
  });

  // 방 나가기
  const leaveRoom = useLeaveRoom();

  // 로컬 상태
  const [isReady, setIsReady] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("players");

  // ------ WS 이벤트 구독 → 쿼리 갱신 ------

  useWsEvent<PlayerJoinedPayload>("game", WsEventType.SESSION_PLAYER_JOINED, () => {
    refetch();
  });

  useWsEvent<PlayerLeftPayload>("game", WsEventType.SESSION_PLAYER_LEFT, () => {
    refetch();
  });

  useWsEvent<SessionStatePayload>("game", WsEventType.SESSION_STATE, () => {
    refetch();
  });

  // ------ 핸들러 ------

  const handleLeave = useCallback(() => {
    if (!id) return;
    leaveRoom.mutate(id, {
      onSuccess: () => navigate("/lobby"),
    });
  }, [id, leaveRoom, navigate]);

  const handleToggleReady = useCallback(() => {
    const next = !isReady;
    setIsReady(next);
    send(WsEventType.GAME_ACTION, { type: "ready", ready: next });
  }, [isReady, send]);

  const handleStartGame = useCallback(() => {
    send(WsEventType.GAME_ACTION, { type: "start" });
  }, [send]);

  const handleCloseRoom = useCallback(() => {
    send(WsEventType.GAME_ACTION, { type: "close" });
    navigate("/lobby");
  }, [send, navigate]);

  // ------ 파생 상태 ------

  const players = room?.players ?? [];
  const isHost = currentUser ? room?.host_id === currentUser.id : false;
  const nonHostPlayers = players.filter((p) => !p.is_host);
  const allReady =
    nonHostPlayers.length > 0 && nonHostPlayers.every((p) => p.is_ready);
  const hasMinPlayers = players.length >= (room?.theme.player_count_min ?? 2);

  // ------ 로딩 / 에러 ------

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !room) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-slate-400">방 정보를 불러올 수 없습니다.</p>
        <Button variant="secondary" onClick={() => navigate("/lobby")}>
          로비로 돌아가기
        </Button>
      </div>
    );
  }

  // ------ 렌더링 ------

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      {/* 헤더 */}
      <RoomHeader
        themeTitle={room.theme_title}
        roomCode={room.code}
        playerCount={room.player_count}
        maxPlayers={room.max_players}
        status={room.status}
      />

      {/* 모바일 탭 전환 */}
      <div className="flex gap-2 md:hidden">
        <Button
          variant={mobileTab === "players" ? "primary" : "ghost"}
          size="sm"
          leftIcon={<Users className="h-4 w-4" />}
          onClick={() => setMobileTab("players")}
          className="flex-1"
        >
          참가자
        </Button>
        <Button
          variant={mobileTab === "chat" ? "primary" : "ghost"}
          size="sm"
          leftIcon={<MessageSquare className="h-4 w-4" />}
          onClick={() => setMobileTab("chat")}
          className="flex-1"
        >
          채팅
        </Button>
      </div>

      {/* 2컬럼 레이아웃 (데스크탑) / 탭 전환 (모바일) */}
      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        {/* 왼쪽: 참가자 + 호스트 컨트롤 */}
        <div
          className={`flex flex-col gap-4 ${
            mobileTab !== "players" ? "hidden md:flex" : "flex"
          }`}
        >
          <PlayerList players={players} maxPlayers={room.max_players} />
          <HostControls
            isHost={isHost}
            allReady={allReady}
            hasMinPlayers={hasMinPlayers}
            onStartGame={handleStartGame}
            onCloseRoom={handleCloseRoom}
          />
        </div>

        {/* 오른쪽: 채팅 */}
        <div
          className={`h-[400px] md:h-[500px] ${
            mobileTab !== "chat" ? "hidden md:block" : "block"
          }`}
        >
          <RoomChat send={send} />
        </div>
      </div>

      {/* 하단: 레디 + 나가기 */}
      <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-4">
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
            variant={isReady ? "secondary" : "primary"}
            leftIcon={<Shield className="h-4 w-4" />}
            onClick={handleToggleReady}
          >
            {isReady ? "준비 취소" : "준비 완료"}
          </Button>
        )}
      </div>
    </div>
  );
}
