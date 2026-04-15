import { Trophy, Medal, User } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlayerEndingScore {
  playerId: string;
  nickname: string;
  score: number;
  clueCount: number;
  badge: string | null;
}

interface EndingPlayerCardProps {
  entry: PlayerEndingScore;
  rank: number;
  staggerIndex: number;
}

// ---------------------------------------------------------------------------
// Rank icon helper
// ---------------------------------------------------------------------------

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-amber-400" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-300" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-700" />;
  return (
    <div className="flex h-5 w-5 items-center justify-center">
      <span className="text-xs font-bold text-slate-500">{rank}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EndingPlayerCard
// ---------------------------------------------------------------------------

export function EndingPlayerCard({ entry, rank, staggerIndex }: EndingPlayerCardProps) {
  const delay = `${staggerIndex * 100}ms`;
  const isTop = rank === 1;

  return (
    <div
      className={`motion-safe:animate-fade-slide-up flex items-center gap-3 rounded-lg border p-3 transition-colors ${
        isTop
          ? "border-amber-700/50 bg-amber-900/20"
          : "border-slate-700 bg-slate-800/40"
      }`}
      style={{ animationDelay: delay, animationFillMode: "backwards" }}
    >
      {/* Rank */}
      <div className="shrink-0">
        <RankIcon rank={rank} />
      </div>

      {/* Avatar */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700">
        <User className="h-4 w-4 text-slate-300" />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${isTop ? "text-amber-300" : "text-slate-200"}`}>
          {entry.nickname}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          단서 {entry.clueCount}개 기여
        </p>
      </div>

      {/* Score + Badge */}
      <div className="shrink-0 text-right">
        <p className={`text-sm font-bold ${isTop ? "text-amber-400" : "text-slate-300"}`}>
          {entry.score}점
        </p>
        {entry.badge && (
          <p className="mt-0.5 text-xs text-amber-500">{entry.badge}</p>
        )}
      </div>
    </div>
  );
}
