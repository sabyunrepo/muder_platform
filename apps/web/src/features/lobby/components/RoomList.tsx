import { useNavigate } from 'react-router';
import { DoorOpen } from 'lucide-react';
import { Button, Badge, EmptyState, Spinner } from '@/shared/components/ui';
import { useRooms, useJoinRoom } from '../api';

/** 방 상태별 Badge variant */
const statusVariant: Record<string, 'success' | 'warning' | 'danger'> = {
  waiting: 'success',
  playing: 'warning',
  full: 'danger',
};

const statusLabel: Record<string, string> = {
  waiting: '대기 중',
  playing: '진행 중',
  full: '만원',
};

export function RoomList() {
  const navigate = useNavigate();
  const { data: rooms, isLoading, isError, refetch } = useRooms({ limit: 20 });
  const joinRoom = useJoinRoom();

  const handleJoin = (roomId: string) => {
    joinRoom.mutate(roomId, {
      onSuccess: (data) => {
        navigate(`/room/${data.id}`);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <p className="text-sm text-red-400">방 목록을 불러오지 못했습니다.</p>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          재시도
        </Button>
      </div>
    );
  }

  if (!rooms || rooms.length === 0) {
    return (
      <EmptyState
        icon={<DoorOpen className="h-10 w-10" />}
        title="현재 대기 중인 방이 없습니다"
        description="새로운 방을 만들어 게임을 시작하세요."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-slate-400">
            <th className="px-3 py-2 font-medium">코드</th>
            <th className="px-3 py-2 font-medium">테마</th>
            <th className="px-3 py-2 font-medium">호스트</th>
            <th className="px-3 py-2 font-medium">인원</th>
            <th className="px-3 py-2 font-medium">상태</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => {
            const isFull = room.player_count >= room.max_players;
            const effectiveStatus = isFull ? 'full' : room.status;

            return (
              <tr
                key={room.id}
                className="border-b border-slate-800/50 text-slate-200 transition-colors hover:bg-slate-800/30"
              >
                <td className="px-3 py-3 font-mono text-xs text-slate-400">
                  {room.code}
                </td>
                <td className="px-3 py-3">{room.theme_title}</td>
                <td className="px-3 py-3 text-slate-300">{room.host_nickname}</td>
                <td className="px-3 py-3">
                  {room.player_count}/{room.max_players}
                </td>
                <td className="px-3 py-3">
                  <Badge variant={statusVariant[effectiveStatus] ?? 'default'}>
                    {statusLabel[effectiveStatus] ?? effectiveStatus}
                  </Badge>
                </td>
                <td className="px-3 py-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={effectiveStatus !== 'waiting'}
                    isLoading={joinRoom.isPending && joinRoom.variables === room.id}
                    onClick={() => handleJoin(room.id)}
                  >
                    참가
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
