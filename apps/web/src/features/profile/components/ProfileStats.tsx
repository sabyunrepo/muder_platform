import { Gamepad2, Trophy, Clock, Calendar } from "lucide-react";
import { Card } from "@/shared/components/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileStatsProps {
  totalGames: number;
  winCount: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 날짜 포맷
// ---------------------------------------------------------------------------

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

function formatDate(iso: string): string {
  try {
    return dateFormatter.format(new Date(iso));
  } catch {
    return "-";
  }
}

// ---------------------------------------------------------------------------
// 스탯 아이템
// ---------------------------------------------------------------------------

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function StatItem({ icon, label, value }: StatItemProps) {
  return (
    <Card className="flex flex-col items-center gap-2 py-5">
      <div className="text-amber-500">{icon}</div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-lg font-semibold text-slate-100">{value}</p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ProfileStats
// ---------------------------------------------------------------------------

export function ProfileStats({
  totalGames,
  winCount,
  createdAt,
}: ProfileStatsProps) {
  // 승률 계산 — 게임이 없으면 "-"
  const winRate =
    totalGames > 0
      ? `${Math.round((winCount / totalGames) * 100)}%`
      : "-";

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-200">통계</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatItem
          icon={<Gamepad2 className="h-5 w-5" />}
          label="총 게임"
          value={totalGames > 0 ? String(totalGames) : "-"}
        />
        <StatItem
          icon={<Trophy className="h-5 w-5" />}
          label="승률"
          value={winRate}
        />
        <StatItem
          icon={<Clock className="h-5 w-5" />}
          label="플레이 시간"
          value="-"
        />
        <StatItem
          icon={<Calendar className="h-5 w-5" />}
          label="가입일"
          value={formatDate(createdAt)}
        />
      </div>
    </section>
  );
}
