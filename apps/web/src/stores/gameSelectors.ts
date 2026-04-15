import type { GameSessionState } from "./gameSessionStore";
import type { Player } from "@mmp/shared";

// ---------------------------------------------------------------------------
// Primitive selectors
// ---------------------------------------------------------------------------

export const selectSessionId = (s: GameSessionState) => s.sessionId;
export const selectPhase = (s: GameSessionState) => s.phase;
export const selectPlayers = (s: GameSessionState) => s.players;
export const selectModules = (s: GameSessionState) => s.modules;
export const selectRound = (s: GameSessionState) => s.round;
export const selectPhaseDeadline = (s: GameSessionState) => s.phaseDeadline;
export const selectIsGameActive = (s: GameSessionState) => s.isGameActive;
export const selectMyPlayerId = (s: GameSessionState) => s.myPlayerId;
export const selectMyRole = (s: GameSessionState) => s.myRole;

// ---------------------------------------------------------------------------
// Derived selectors
// ---------------------------------------------------------------------------

/** My Player object. */
export const selectMyPlayer = (s: GameSessionState): Player | undefined =>
  s.players.find((p) => p.id === s.myPlayerId);

/** Whether the local player is the host. */
export const selectAmIHost = (s: GameSessionState): boolean =>
  s.players.some((p) => p.id === s.myPlayerId && p.isHost);

/** Only alive players. */
export const selectAlivePlayers = (s: GameSessionState): Player[] =>
  s.players.filter((p) => p.isAlive);

/** Total player count. */
export const selectPlayerCount = (s: GameSessionState): number => s.players.length;

/** True when all non-host players are ready. */
export const selectAllReady = (s: GameSessionState): boolean =>
  s.players.filter((p) => !p.isHost).every((p) => p.isReady);
