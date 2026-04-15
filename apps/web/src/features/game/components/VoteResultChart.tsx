import { useCountUp } from "../hooks/useCountUp";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VoteResult {
  playerId: string;
  nickname: string;
  votes: number;
}

interface VoteBarProps {
  result: VoteResult;
  maxVotes: number;
  isTop: boolean;
  staggerIndex: number;
}

interface VoteResultChartProps {
  results: VoteResult[];
}

// ---------------------------------------------------------------------------
// VoteBar — 훅은 조건부 호출 불가 → 컴포넌트 분리
// ---------------------------------------------------------------------------

function VoteBar({ result, maxVotes, isTop, staggerIndex }: VoteBarProps) {
  const animatedVotes = useCountUp(result.votes);
  const widthPct = maxVotes > 0 ? (animatedVotes / maxVotes) * 100 : 0;
  const barColor = isTop ? "bg-amber-500" : "bg-slate-600";
  const delay = `${staggerIndex * 100}ms`;

  return (
    <div
      className="motion-safe:animate-fade-slide-up space-y-1"
      style={
        {
          "--stagger-index": staggerIndex,
          animationDelay: delay,
          animationFillMode: "backwards",
        } as React.CSSProperties
      }
    >
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-200">{result.nickname}</span>
        <span className="font-medium text-amber-400">{animatedVotes}표</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

export function VoteResultChart({ results }: VoteResultChartProps) {
  const maxVotes = Math.max(...results.map((r) => r.votes), 1);

  // 낮은 득표 → 높은 득표 순 stagger
  const sorted = [...results].sort((a, b) => a.votes - b.votes);

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-slate-300">투표 결과</h4>
      {sorted.map((r, i) => (
        <VoteBar
          key={r.playerId}
          result={r}
          maxVotes={maxVotes}
          isTop={r.votes === maxVotes}
          staggerIndex={i}
        />
      ))}
    </div>
  );
}
