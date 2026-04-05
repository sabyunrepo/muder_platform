import { GamePhase } from "@mmp/shared";

// ---------------------------------------------------------------------------
// Phase 한글 매핑 + 색상 (GameHUD, PhaseTransition 등에서 공유)
// ---------------------------------------------------------------------------

export const PHASE_LABEL: Record<GamePhase, string> = {
  [GamePhase.LOBBY]: "로비",
  [GamePhase.INTRO]: "소개",
  [GamePhase.INVESTIGATION]: "탐색",
  [GamePhase.DISCUSSION]: "토론",
  [GamePhase.VOTING]: "투표",
  [GamePhase.REVEAL]: "공개",
  [GamePhase.RESULT]: "결과",
};

export const PHASE_COLOR: Record<GamePhase, string> = {
  [GamePhase.LOBBY]: "bg-slate-600 text-slate-200",
  [GamePhase.INTRO]: "bg-blue-600 text-blue-100",
  [GamePhase.INVESTIGATION]: "bg-emerald-600 text-emerald-100",
  [GamePhase.DISCUSSION]: "bg-amber-600 text-amber-100",
  [GamePhase.VOTING]: "bg-purple-600 text-purple-100",
  [GamePhase.REVEAL]: "bg-red-600 text-red-100",
  [GamePhase.RESULT]: "bg-slate-600 text-slate-200",
};
