import { useNavigate } from 'react-router';
import { DoorOpen } from 'lucide-react';
import { Alert, Button, Badge, EmptyState, LoadingState, Table } from '@/shared/components/ui';
import type { TableColumn } from '@/shared/components/ui';
import { useAuthStore } from '@/stores/authStore';
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
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const { data: rooms, isLoading, isError, refetch } = useRooms({ limit: 20 });
  const joinRoom = useJoinRoom();

  const handleJoin = (roomId: string) => {
    if (isAuthLoading) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    joinRoom.mutate(roomId, {
      onSuccess: (data) => {
        navigate(`/room/${data.id}`);
      },
    });
  };

  if (isLoading) {
    return <LoadingState label="공개 방을 불러오는 중" />;
  }

  if (isError) {
    return (
      <Alert tone="error" title="방 목록을 불러오지 못했습니다">
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            재시도
          </Button>
        </div>
      </Alert>
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

  const columns: TableColumn<(typeof rooms)[number]>[] = [
    { id: 'code', header: '코드', render: (room) => <span className="font-mono text-xs text-[var(--mmp-color-steel)]">{room.code}</span> },
    { id: 'theme', header: '테마', render: (room) => room.theme_title },
    { id: 'host', header: '호스트', render: (room) => <span className="text-[var(--mmp-color-charcoal)]">{room.host_nickname}</span> },
    { id: 'players', header: '인원', render: (room) => `${room.player_count}/${room.max_players}` },
    {
      id: 'status',
      header: '상태',
      render: (room) => {
        const effectiveStatus = room.player_count >= room.max_players ? 'full' : room.status;
        return (
          <Badge variant={statusVariant[effectiveStatus] ?? 'default'}>
            {statusLabel[effectiveStatus] ?? effectiveStatus}
          </Badge>
        );
      },
    },
    {
      id: 'action',
      header: '',
      align: 'right',
      render: (room) => {
        const effectiveStatus = room.player_count >= room.max_players ? 'full' : room.status;
        return (
          <Button
            size="sm"
            variant="secondary"
            disabled={effectiveStatus !== 'waiting' || isAuthLoading}
            isLoading={joinRoom.isPending && joinRoom.variables === room.id}
            onClick={() => handleJoin(room.id)}
          >
            참가
          </Button>
        );
      },
    },
  ];

  return <Table columns={columns} data={rooms} getRowKey={(room) => room.id} />;
}
