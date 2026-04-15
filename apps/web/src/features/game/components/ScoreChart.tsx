import type { PlayerEndingScore } from "./EndingPlayerCard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScoreChartProps {
  scores: PlayerEndingScore[];
}

// ---------------------------------------------------------------------------
// ClueBar — 단서 기여도 단위 막대
// ---------------------------------------------------------------------------

function ClueBar({ entry, maxClues, index }: { entry: PlayerEndingScore; maxClues: number; index: number }) {
  const pct = maxClues > 0 ? (entry.clueCount / maxClues) * 100 : 0;
  const delay = `${index * 80}ms`;

  return (
    <div
      className="motion-safe:animate-fade-slide-up space-y-1"
      style={{ animationDelay: delay, animationFillMode: "backwards" }}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="truncate max-w-[8rem] text-slate-300">{entry.nickname}</span>
        <span className="ml-2 shrink-0 font-medium text-amber-400">{entry.clueCount}개</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-amber-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScoreChart — 단서 기여도 차트
// ---------------------------------------------------------------------------

export function ScoreChart({ scores }: ScoreChartProps) {
  if (scores.length === 0) return null;

  const maxClues = Math.max(...scores.map((s) => s.clueCount), 1);

  // 높은 기여 → 낮은 기여 정렬
  const sorted = [...scores].sort((a, b) => b.clueCount - a.clueCount);

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        단서 기여도
      </h4>
      <div className="space-y-2">
        {sorted.map((entry, i) => (
          <ClueBar
            key={entry.playerId}
            entry={entry}
            maxClues={maxClues}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}
