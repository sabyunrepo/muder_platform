import { Crown, CheckCircle, Circle, UserPlus } from 'lucide-react';
import { Badge } from '@/shared/components/ui';
import type { RoomPlayer } from '@/features/lobby/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlayerListProps {
  players: RoomPlayer[];
  maxPlayers: number;
  characterNameById?: Map<string, string>;
  currentUserId?: string;
}

// ---------------------------------------------------------------------------
// 플레이어 카드
// ---------------------------------------------------------------------------

function PlayerCard({
  player,
  index,
  characterName,
  isCurrentUser,
}: {
  player: RoomPlayer;
  index: number;
  characterName?: string;
  isCurrentUser?: boolean;
}) {
  const readyLabel = player.is_ready ? '준비 완료' : '미준비';

  return (
    <div
      className="motion-safe:animate-fade-slide-up flex items-center gap-3 rounded-lg border border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface)] p-3"
      style={
        {
          '--stagger-index': index,
          animationDelay: `calc(var(--stagger-index) * 50ms)`,
          animationFillMode: 'backwards',
        } as React.CSSProperties
      }
    >
      {/* 아바타 */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--mmp-color-muted)] text-[var(--mmp-color-charcoal)]">
        {player.avatar_url ? (
          <img
            src={player.avatar_url}
            alt={player.nickname}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <span className="text-sm font-bold">{player.nickname.charAt(0).toUpperCase()}</span>
        )}
      </div>

      {/* 닉네임 + 상태 */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-[var(--mmp-color-ink)]">
            {player.nickname}
          </span>
          {isCurrentUser && (
            <span className="text-[10px] font-medium text-[var(--mmp-color-primary)]">나</span>
          )}
          {player.is_host && (
            <Badge variant="warning" size="sm">
              <Crown className="mr-1 h-3 w-3" />
              호스트
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {characterName ? (
            <Badge variant="info" size="sm">
              {characterName}
            </Badge>
          ) : (
            <Badge variant="default" size="sm">
              캐릭터 미선택
            </Badge>
          )}
          {!player.is_host && (
            <Badge variant={player.is_ready ? 'success' : 'default'} size="sm">
              {readyLabel}
            </Badge>
          )}
        </div>
      </div>

      {/* 레디 상태 */}
      {player.is_host ? null : player.is_ready ? (
        <CheckCircle
          aria-label={readyLabel}
          className="h-5 w-5 shrink-0 text-[var(--mmp-color-success)]"
        />
      ) : (
        <Circle
          aria-label={readyLabel}
          className="h-5 w-5 shrink-0 text-[var(--mmp-color-muted)]"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 빈 슬롯
// ---------------------------------------------------------------------------

function EmptySlot() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-[var(--mmp-color-hairline-strong)] p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--mmp-color-hairline-strong)]">
        <UserPlus className="h-4 w-4 text-[var(--mmp-color-steel)]" />
      </div>
      <span className="text-sm text-[var(--mmp-color-steel)]">빈 자리</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlayerList
// ---------------------------------------------------------------------------

export function PlayerList({
  players,
  maxPlayers,
  characterNameById,
  currentUserId,
}: PlayerListProps) {
  const emptySlots = Math.max(0, maxPlayers - players.length);

  return (
    <div className="flex flex-col gap-2">
      {players.map((player, index) => (
        <PlayerCard
          key={player.id ?? player.user_id}
          player={player}
          index={index}
          characterName={
            player.character_id ? characterNameById?.get(player.character_id) : undefined
          }
          isCurrentUser={player.user_id === currentUserId}
        />
      ))}
      {Array.from({ length: emptySlots }, (_, i) => (
        <EmptySlot key={`empty-${i}`} />
      ))}
    </div>
  );
}
