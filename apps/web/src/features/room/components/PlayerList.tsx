import { Crown, CheckCircle, Circle, UserPlus } from "lucide-react";
import { Card, Badge } from "@/shared/components/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RoomPlayer {
  id: string;
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  is_host: boolean;
  is_ready: boolean;
  joined_at: string;
}

interface PlayerListProps {
  players: RoomPlayer[];
  maxPlayers: number;
}

// ---------------------------------------------------------------------------
// 플레이어 카드
// ---------------------------------------------------------------------------

function PlayerCard({ player }: { player: RoomPlayer }) {
  return (
    <Card className="flex items-center gap-3 p-3">
      {/* 아바타 */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-300">
        {player.avatar_url ? (
          <img
            src={player.avatar_url}
            alt={player.nickname}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <span className="text-sm font-bold">
            {player.nickname.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* 닉네임 + 역할 */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm font-medium text-slate-100">
          {player.nickname}
        </span>
        {player.is_host && (
          <Badge variant="warning" size="sm">
            <Crown className="mr-1 h-3 w-3" />
            호스트
          </Badge>
        )}
      </div>

      {/* 레디 상태 */}
      {player.is_host ? null : player.is_ready ? (
        <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />
      ) : (
        <Circle className="h-5 w-5 shrink-0 text-slate-600" />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 빈 슬롯
// ---------------------------------------------------------------------------

function EmptySlot() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-700 p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-600">
        <UserPlus className="h-4 w-4 text-slate-600" />
      </div>
      <span className="text-sm text-slate-500">빈 자리</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlayerList
// ---------------------------------------------------------------------------

export function PlayerList({ players, maxPlayers }: PlayerListProps) {
  const emptySlots = Math.max(0, maxPlayers - players.length);

  return (
    <div className="flex flex-col gap-2">
      {players.map((player) => (
        <PlayerCard key={player.id} player={player} />
      ))}
      {Array.from({ length: emptySlots }, (_, i) => (
        <EmptySlot key={`empty-${i}`} />
      ))}
    </div>
  );
}
