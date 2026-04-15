import type { GamePhase } from "@mmp/shared";
import { getPhaseCount, getPhaseIndex } from "@mmp/game-logic";
import { PHASE_LABEL, PHASE_COLOR } from "../constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PhaseBarProps {
  /** Current game phase. Null renders nothing. */
  phase: GamePhase | null;
  /** Current round number (1-based). */
  round?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_PHASES = [
  "lobby",
  "intro",
  "investigation",
  "discussion",
  "voting",
  "reveal",
  "result",
] as const;

// ---------------------------------------------------------------------------
// PhaseBar
// ---------------------------------------------------------------------------

/**
 * Stateless phase progress bar.
 *
 * Shows each phase as a chip, highlighting the active one,
 * and draws a progress line below.
 */
export function PhaseBar({ phase, round = 1 }: PhaseBarProps) {
  if (!phase) return null;

  const currentIndex = getPhaseIndex(phase);
  const totalPhases = getPhaseCount();
  const progressPercent =
    totalPhases > 0 ? ((currentIndex + 1) / totalPhases) * 100 : 0;

  return (
    <div
      role="region"
      aria-label="게임 진행 단계"
    >
      {/* Phase chips row */}
      <div className="flex items-center gap-1 overflow-x-auto px-4 py-2 scrollbar-none">
        {ALL_PHASES.map((p, idx) => {
          const isActive = p === phase;
          const isPast = idx < currentIndex;

          let chipCls: string;
          if (isActive) {
            chipCls = PHASE_COLOR[p as GamePhase];
          } else if (isPast) {
            chipCls = "bg-slate-700 text-slate-400";
          } else {
            chipCls = "bg-slate-800 text-slate-600";
          }

          return (
            <span
              key={p}
              className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${chipCls}`}
              aria-current={isActive ? "step" : undefined}
            >
              {PHASE_LABEL[p as GamePhase]}
            </span>
          );
        })}

        {/* Round badge pushed to the right */}
        <span className="ml-auto shrink-0 text-xs font-medium text-slate-400">
          R{round}
        </span>
      </div>

      {/* Progress line */}
      <div className="h-0.5 w-full bg-slate-800">
        <div
          className="h-0.5 bg-amber-500 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}
