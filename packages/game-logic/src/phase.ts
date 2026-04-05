import { GamePhase } from "@mmp/shared";

/** Ordered phase sequence for standard game flow. */
const PHASE_ORDER: readonly GamePhase[] = [
  GamePhase.LOBBY,
  GamePhase.INTRO,
  GamePhase.INVESTIGATION,
  GamePhase.DISCUSSION,
  GamePhase.VOTING,
  GamePhase.REVEAL,
  GamePhase.RESULT,
] as const;

/** Check if a phase is a terminal phase (no next phase). */
export function isTerminalPhase(phase: GamePhase): boolean {
  return phase === GamePhase.RESULT;
}

/** Check if the phase is complete based on deadline. */
export function isPhaseExpired(deadline: number | null, now?: number): boolean {
  if (deadline === null) return false;
  return (now ?? Date.now()) >= deadline;
}

/** Get the next phase in the standard flow. Returns null if terminal. */
export function getNextPhase(current: GamePhase): GamePhase | null {
  const idx = PHASE_ORDER.indexOf(current);
  if (idx === -1 || idx === PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[idx + 1] ?? null;
}

/** Get the index of a phase (useful for progress indicators). */
export function getPhaseIndex(phase: GamePhase): number {
  return PHASE_ORDER.indexOf(phase);
}

/** Get total number of phases. */
export function getPhaseCount(): number {
  return PHASE_ORDER.length;
}

/** Check if phase A comes before phase B in the standard flow. */
export function isPhaseBefore(a: GamePhase, b: GamePhase): boolean {
  return getPhaseIndex(a) < getPhaseIndex(b);
}
