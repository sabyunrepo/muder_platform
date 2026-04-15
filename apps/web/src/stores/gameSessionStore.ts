import { create } from "zustand";
import type { GamePhase, GameState, ModuleConfig, Player, PlayerRole } from "@mmp/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GameSessionState {
  // Domain state
  sessionId: string | null;
  phase: GamePhase | null;
  players: Player[];
  modules: ModuleConfig[];
  round: number;
  phaseDeadline: number | null;
  isGameActive: boolean;

  // Local player identity
  myPlayerId: string | null;
  myRole: PlayerRole | null;
}

export interface GameSessionActions {
  initGame: (state: GameState, myPlayerId: string) => void;
  resetGame: () => void;
  setPhase: (phase: GamePhase, deadline: number | null, round: number) => void;
  setPlayers: (players: Player[]) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  updateModuleState: (moduleId: string, settings: Record<string, unknown>) => void;
  setGameState: (state: GameState) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INITIAL_STATE: GameSessionState = {
  sessionId: null,
  phase: null,
  players: [],
  modules: [],
  round: 0,
  phaseDeadline: null,
  isGameActive: false,
  myPlayerId: null,
  myRole: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractMyRole(players: Player[], myPlayerId: string | null): PlayerRole | null {
  if (!myPlayerId) return null;
  const me = players.find((p) => p.id === myPlayerId);
  return me?.role ?? null;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGameSessionStore = create<GameSessionState & GameSessionActions>()(
  (set, get) => ({
    ...INITIAL_STATE,

    initGame: (state, myPlayerId) => {
      set({
        sessionId: state.sessionId,
        phase: state.phase,
        players: state.players,
        modules: state.modules,
        round: state.round,
        phaseDeadline: state.phaseDeadline,
        isGameActive: true,
        myPlayerId,
        myRole: extractMyRole(state.players, myPlayerId),
      });
    },

    resetGame: () => {
      set({ ...INITIAL_STATE });
    },

    setPhase: (phase, deadline, round) => {
      set({ phase, phaseDeadline: deadline, round });
    },

    setPlayers: (players) => {
      const { myPlayerId } = get();
      set({ players, myRole: extractMyRole(players, myPlayerId) });
    },

    addPlayer: (player) => {
      const { players } = get();
      const filtered = players.filter((p) => p.id !== player.id);
      set({ players: [...filtered, player] });
    },

    removePlayer: (playerId) => {
      const { players, myPlayerId } = get();
      const next = players.filter((p) => p.id !== playerId);
      set({ players: next, myRole: extractMyRole(next, myPlayerId) });
    },

    updateModuleState: (moduleId, settings) => {
      const { modules } = get();
      set({
        modules: modules.map((m) =>
          m.id === moduleId ? { ...m, settings: { ...m.settings, ...settings } } : m,
        ),
      });
    },

    setGameState: (state) => {
      const { myPlayerId } = get();
      set({
        sessionId: state.sessionId,
        phase: state.phase,
        players: state.players,
        modules: state.modules,
        round: state.round,
        phaseDeadline: state.phaseDeadline,
        isGameActive: true,
        myRole: extractMyRole(state.players, myPlayerId),
      });
    },
  }),
);
