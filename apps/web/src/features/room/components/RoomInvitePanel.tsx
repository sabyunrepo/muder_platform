import { useMemo, useState } from 'react';
import { Send, UserPlus } from 'lucide-react';

import { useInviteRoomFriends } from '@/features/lobby/api';
import { useFriends } from '@/features/social/api';
import { Alert, Button, Panel } from '@/shared/components/ui';

interface RoomInvitePanelProps {
  roomId: string;
  isHost: boolean;
}

export function RoomInvitePanel({ roomId, isHost }: RoomInvitePanelProps) {
  const friends = useFriends();
  const inviteFriends = useInviteRoomFriends();
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);

  const selectedCount = selectedFriendIds.length;
  const inviteResult = inviteFriends.data;
  const statusMessage = useMemo(() => {
    if (!inviteResult) return null;
    return `초대 ${inviteResult.sent?.length ?? 0}명 전송, ${inviteResult.skipped?.length ?? 0}명 건너뜀`;
  }, [inviteResult]);

  const toggleFriend = (friendId: string) => {
    setSelectedFriendIds((current) =>
      current.includes(friendId) ? current.filter((id) => id !== friendId) : [...current, friendId]
    );
  };

  const handleInvite = () => {
    if (!selectedCount) return;
    inviteFriends.mutate({
      roomId,
      friend_ids: selectedFriendIds,
    });
  };

  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--mmp-color-ink)]">
            <UserPlus className="h-4 w-4" />
            친구 초대
          </h2>
          <p className="mt-1 text-xs text-[var(--mmp-color-steel)]">
            방 코드는 헤더에서 복사할 수 있습니다.
          </p>
        </div>
        {isHost && (
          <Button
            size="sm"
            leftIcon={<Send className="h-4 w-4" />}
            onClick={handleInvite}
            disabled={selectedCount === 0}
            isLoading={inviteFriends.isPending}
          >
            선택한 친구 초대
          </Button>
        )}
      </div>

      {!isHost ? (
        <p className="text-sm text-[var(--mmp-color-steel)]">
          친구 초대는 방장만 보낼 수 있습니다.
        </p>
      ) : friends.isLoading ? (
        <p className="text-sm text-[var(--mmp-color-steel)]">친구 목록을 불러오는 중입니다.</p>
      ) : friends.isError ? (
        <Alert tone="error" title="친구 목록을 불러올 수 없습니다" />
      ) : (friends.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-[var(--mmp-color-steel)]">
          아직 초대할 친구가 없습니다. 친구를 추가한 뒤 다시 시도해 주세요.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {(friends.data ?? []).map((friend) => (
            <label
              key={friend.id}
              className="flex min-h-10 items-center gap-2 rounded-md border border-[var(--mmp-color-hairline)] px-3 py-2 text-sm text-[var(--mmp-color-charcoal)]"
            >
              <input
                type="checkbox"
                checked={selectedFriendIds.includes(friend.id)}
                onChange={() => toggleFriend(friend.id)}
                className="h-4 w-4 accent-[var(--mmp-color-primary)]"
              />
              <span className="font-medium text-[var(--mmp-color-ink)]">{friend.nickname}</span>
            </label>
          ))}
        </div>
      )}

      {statusMessage && (
        <p className="text-sm font-medium text-[var(--mmp-color-success)]">{statusMessage}</p>
      )}
      {inviteFriends.isError && (
        <p className="text-sm font-medium text-[var(--mmp-color-error)]">
          초대를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      )}
    </Panel>
  );
}
