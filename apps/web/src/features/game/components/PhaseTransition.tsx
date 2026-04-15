import { useState, useEffect, useRef, useCallback } from "react";
import type { GamePhase } from "@mmp/shared";
import { useGameSessionStore as useGameStore } from "@/stores/gameSessionStore";
import { PHASE_LABEL } from "../constants";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BANNER_VISIBLE_MS = 1200;
const BANNER_EXIT_MS = 400;

// ---------------------------------------------------------------------------
// PhaseTransition — 상단 배너 (비차단)
// ---------------------------------------------------------------------------

export function PhaseTransition() {
  const phase = useGameStore((s) => s.phase);
  const prevPhaseRef = useRef<GamePhase | null>(null);
  const [displayPhase, setDisplayPhase] = useState<GamePhase | null>(null);
  const [stage, setStage] = useState<"idle" | "enter" | "exit">("idle");
  const exitTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const dismiss = useCallback(() => {
    setStage("exit");
    exitTimerRef.current = setTimeout(() => {
      setStage("idle");
      setDisplayPhase(null);
    }, BANNER_EXIT_MS);
  }, []);

  // Cleanup exit timer on unmount
  useEffect(() => {
    return () => clearTimeout(exitTimerRef.current);
  }, []);

  useEffect(() => {
    if (prevPhaseRef.current === null) {
      prevPhaseRef.current = phase;
      return;
    }

    if (phase && phase !== prevPhaseRef.current) {
      prevPhaseRef.current = phase;
      clearTimeout(exitTimerRef.current);
      setDisplayPhase(phase);
      setStage("enter");

      const timer = setTimeout(dismiss, BANNER_VISIBLE_MS);
      return () => clearTimeout(timer);
    }
  }, [phase, dismiss]);

  if (stage === "idle" || !displayPhase) return null;

  const animClass =
    stage === "enter"
      ? "motion-safe:animate-slide-in-top"
      : "motion-safe:animate-slide-out-top";

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-center border-b border-amber-500/30 bg-slate-950/95 ${animClass}`}
      role="alert"
      aria-live="assertive"
      style={{ pointerEvents: "none" }}
    >
      <h1 className="motion-safe:animate-fade-in text-lg font-bold text-amber-400">
        {PHASE_LABEL[displayPhase]}
      </h1>
    </div>
  );
}
