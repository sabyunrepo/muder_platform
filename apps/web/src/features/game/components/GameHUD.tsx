import { useState, useEffect, lazy, Suspense } from "react";
import { Timer } from "lucide-react";
import {
  getRemainingTime,
  formatRemainingTime,
  getPhaseIndex,
  getPhaseCount,
} from "@mmp/game-logic";
import { useGameSessionStore as useGameStore } from "@/stores/gameSessionStore";
import { PHASE_LABEL, PHASE_COLOR } from "../constants";

const SoundControl = lazy(() =>
  import("@/features/audio/components/SoundControl").then((m) => ({
    default: m.SoundControl,
  })),
);

// ---------------------------------------------------------------------------
// GameHUD
// ---------------------------------------------------------------------------

export function GameHUD() {
  const phase = useGameStore((s) => s.phase);
  const round = useGameStore((s) => s.round);
  const phaseDeadline = useGameStore((s) => s.phaseDeadline);

  // 1초 간격 타이머 갱신용 tick
  const [, setTick] = useState(0);

  useEffect(() => {
    if (phaseDeadline === null) return;

    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [phaseDeadline]);

  if (!phase) return null;

  // 타이머 계산
  const remainingMs = phaseDeadline !== null ? getRemainingTime(phaseDeadline) : null;
  const isUrgent = remainingMs !== null && remainingMs < 30_000;

  // 진행바 비율
  const phaseIndex = getPhaseIndex(phase);
  const totalPhases = getPhaseCount();
  const progressPercent = totalPhases > 0 ? ((phaseIndex + 1) / totalPhases) * 100 : 0;

  return (
    <div className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
      {/* 메인 바 */}
      <div className="flex items-center justify-between px-4 py-2">
        {/* 왼쪽: Phase Badge */}
        <span
          className={`rounded-md px-3 py-1 text-xs font-bold ${PHASE_COLOR[phase]}`}
        >
          {PHASE_LABEL[phase]}
        </span>

        {/* 중앙: 타이머 카운트다운 */}
        {phaseDeadline !== null && (
          <div
            className={`flex items-center gap-1.5 font-mono text-sm font-semibold ${
              isUrgent ? "animate-pulse text-red-400" : "text-slate-200"
            }`}
          >
            <Timer className="h-4 w-4" />
            <span>{formatRemainingTime(phaseDeadline)}</span>
          </div>
        )}

        {/* 오른쪽: 라운드 + 사운드 */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400">
            라운드 {round}
          </span>
          <Suspense fallback={null}>
            <SoundControl />
          </Suspense>
        </div>
      </div>

      {/* 하단: 진행바 */}
      <div className="h-1 w-full bg-slate-800">
        <div
          className="h-1 bg-amber-500 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
