import { useState, useEffect, useRef } from "react";
import type { GamePhase } from "@mmp/shared";
import { useGameStore } from "@/stores/gameStore";
import { PHASE_LABEL } from "../constants";

// ---------------------------------------------------------------------------
// PhaseTransition
// ---------------------------------------------------------------------------

export function PhaseTransition() {
  const phase = useGameStore((s) => s.phase);
  const prevPhaseRef = useRef<GamePhase | null>(null);
  const [visible, setVisible] = useState(false);
  const [displayPhase, setDisplayPhase] = useState<GamePhase | null>(null);

  useEffect(() => {
    // 첫 렌더 시에는 표시하지 않음 (prevPhase === null)
    if (prevPhaseRef.current === null) {
      prevPhaseRef.current = phase;
      return;
    }

    // phase가 변경되었을 때만 표시
    if (phase && phase !== prevPhaseRef.current) {
      prevPhaseRef.current = phase;
      setDisplayPhase(phase);
      setVisible(true);

      // 2초 후 자동 사라짐
      const timer = setTimeout(() => {
        setVisible(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [phase]);

  if (!visible || !displayPhase) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <h1
        className="animate-fade-in text-4xl font-bold text-amber-500"
        style={{
          animation: "fadeIn 0.5s ease-out",
        }}
      >
        {PHASE_LABEL[displayPhase]}
      </h1>

      {/* fade-in 키프레임 인라인 정의 */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
