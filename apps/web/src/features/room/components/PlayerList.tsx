import { Crown, CheckCircle, Circle, UserPlus } from 'lucide-react';
import { Card, Badge } from '@/shared/components/ui';
import type { RoomPlayer } from '@/features/lobby/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlayerListProps {
  players: RoomPlayer[];
  maxPlayers: number;
  characterNameById?: Map<string, string>;
}

// ---------------------------------------------------------------------------
// 플레이어 카드
// ---------------------------------------------------------------------------

function PlayerCard({
  player,
  index,
  characterName,
}: {
  player: RoomPlayer;
  index: number;
  characterName?: string;
}) {
  return (
    <Card
      className="motion-safe:animate-fade-slide-up flex items-center gap-3 p-3"
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

      {/* 닉네임 + 역할 */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm font-medium text-[var(--mmp-color-ink)]">
          {player.nickname}
        </span>
        {player.is_host && (
          <Badge variant="warning" size="sm">
            <Crown className="mr-1 h-3 w-3" />
            호스트
          </Badge>
        )}
        {characterName && (
          <Badge variant="info" size="sm">
            {characterName}
          </Badge>
        )}
      </div>

      {/* 레디 상태 */}
      {player.is_host ? null : player.is_ready ? (
        <CheckCircle className="h-5 w-5 shrink-0 text-[var(--mmp-color-success)]" />
      ) : (
        <Circle className="h-5 w-5 shrink-0 text-[var(--mmp-color-muted)]" />
      )}
    </Card>
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

export function PlayerList({ players, maxPlayers, characterNameById }: PlayerListProps) {
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
        />
      ))}
      {Array.from({ length: emptySlots }, (_, i) => (
        <EmptySlot key={`empty-${i}`} />
      ))}
    </div>
  );
}
