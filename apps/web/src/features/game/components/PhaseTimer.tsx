import { useState, useEffect } from "react";
import { Timer, AlertCircle } from "lucide-react";
import { getRemainingTime, formatRemainingTime } from "@mmp/game-logic";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WARN_AMBER_MS = 60_000; // ≤60s → amber
const WARN_RED_MS = 10_000; // ≤10s → red + pulse

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PhaseTimerProps {
  /**
   * Server deadline as Unix ms timestamp.
   * Null = no timer (phase has no time limit).
   */
  deadlineMs: number | null;
}

// ---------------------------------------------------------------------------
// PhaseTimer
// ---------------------------------------------------------------------------

/**
 * Stateless countdown timer.
 *
 * Internally ticks every 1 s to recompute remaining time from the deadline.
 * Changes colour at ≤60 s (amber) and ≤10 s (red + pulse).
 */
export function PhaseTimer({ deadlineMs }: PhaseTimerProps) {
  // Force re-render every second so the display updates.
  const [, setTick] = useState(0);

  useEffect(() => {
    if (deadlineMs === null) return;

    const id = setInterval(() => setTick((t) => t + 1), 1_000);
    return () => clearInterval(id);
  }, [deadlineMs]);

  if (deadlineMs === null) return null;

  const remainingMs = getRemainingTime(deadlineMs);
  const isRed = remainingMs <= WARN_RED_MS;
  const isAmber = !isRed && remainingMs <= WARN_AMBER_MS;

  const colorCls = isRed
    ? "text-red-400 animate-pulse"
    : isAmber
      ? "text-amber-400"
      : "text-slate-200";

  const Icon = isRed ? AlertCircle : Timer;

  return (
    <div
      className={`flex items-center gap-1.5 font-mono text-sm font-semibold ${colorCls}`}
      role="timer"
      aria-label="남은 시간"
      aria-live={isRed ? "assertive" : "polite"}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{formatRemainingTime(deadlineMs)}</span>
    </div>
  );
}
