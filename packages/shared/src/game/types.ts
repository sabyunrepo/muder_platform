/** Game phase lifecycle. Matches Go server's phase enum. */
export const GamePhase = {
  LOBBY: "lobby",
  INTRO: "intro",
  INVESTIGATION: "investigation",
  DISCUSSION: "discussion",
  VOTING: "voting",
  REVEAL: "reveal",
  RESULT: "result",
} as const;

export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];

/** Player role in a game session. */
export const PlayerRole = {
  MURDERER: "murderer",
  DETECTIVE: "detective",
  CIVILIAN: "civilian",
  SPECTATOR: "spectator",
} as const;

export type PlayerRole = (typeof PlayerRole)[keyof typeof PlayerRole];

/** Player state within a session. */
export interface Player {
  id: string;
  nickname: string;
  role: PlayerRole | null;
  isAlive: boolean;
  isHost: boolean;
  isReady: boolean;
  connectedAt: number;
}

/** Module configuration schema (declarative). */
export interface ModuleConfig {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  settings: Record<string, unknown>;
}

/** Game session state. */
export interface GameState {
  sessionId: string;
  phase: GamePhase;
  players: Player[];
  modules: ModuleConfig[];
  round: number;
  phaseDeadline: number | null;
  createdAt: number;
}

/** Clue item use events (WebSocket). */
export interface ClueItemDeclaredEvent {
  userId: string;
  clueName: string;
}

export interface ClueUsePromptEvent {
  effect: string;
  targetType: string;
}

export interface ClueUseResultEvent {
  clueDetail: {
    id: string;
    title: string;
    description: string | null;
    category: string;
  };
}

export interface ClueItemResolvedEvent {
  userId: string;
}
