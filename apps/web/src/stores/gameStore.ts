import { create } from "zustand";
import type { GamePhase, GameState, ModuleConfig, Player, PlayerRole } from "@mmp/shared";
import { syncServerTime } from "@mmp/game-logic";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GameStoreState {
  // 게임 상태
  sessionId: string | null;
  phase: GamePhase | null;
  players: Player[];
  modules: ModuleConfig[];
  round: number;
  phaseDeadline: number | null;
  isGameActive: boolean;

  // 내 상태
  myPlayerId: string | null;
  myRole: PlayerRole | null;
}

export interface GameStoreActions {
  // 초기화
  initGame: (state: GameState, myPlayerId: string) => void;
  resetGame: () => void;

  // 상태 업데이트 (WS 이벤트에서 호출)
  setPhase: (phase: GamePhase, deadline: number | null, round: number) => void;
  setPlayers: (players: Player[]) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  updateModuleState: (moduleId: string, settings: Record<string, unknown>) => void;

  // 게임 상태 갱신
  setGameState: (state: GameState) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const initialState: GameStoreState = {
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

/** players 배열에서 내 역할을 추출 */
function extractMyRole(players: Player[], myPlayerId: string | null): PlayerRole | null {
  if (!myPlayerId) return null;
  const me = players.find((p) => p.id === myPlayerId);
  return me?.role ?? null;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGameStore = create<GameStoreState & GameStoreActions>()(
  (set, get) => ({
    ...initialState,

    initGame: (state, myPlayerId) => {
      syncServerTime(state.createdAt);
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
      set({ ...initialState });
    },

    setPhase: (phase, deadline, round) => {
      set({ phase, phaseDeadline: deadline, round });
    },

    setPlayers: (players) => {
      const { myPlayerId } = get();
      set({
        players,
        myRole: extractMyRole(players, myPlayerId),
      });
    },

    addPlayer: (player) => {
      const { players } = get();
      // 중복 방지: 이미 존재하면 교체
      const filtered = players.filter((p) => p.id !== player.id);
      set({ players: [...filtered, player] });
    },

    removePlayer: (playerId) => {
      const { players, myPlayerId } = get();
      const next = players.filter((p) => p.id !== playerId);
      set({
        players: next,
        // 내가 퇴장당한 경우 역할 초기화
        myRole: extractMyRole(next, myPlayerId),
      });
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
      syncServerTime(state.createdAt);
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

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectSessionId = (s: GameStoreState) => s.sessionId;
export const selectPhase = (s: GameStoreState) => s.phase;
export const selectPlayers = (s: GameStoreState) => s.players;
export const selectModules = (s: GameStoreState) => s.modules;
export const selectRound = (s: GameStoreState) => s.round;
export const selectPhaseDeadline = (s: GameStoreState) => s.phaseDeadline;
export const selectIsGameActive = (s: GameStoreState) => s.isGameActive;
export const selectMyPlayerId = (s: GameStoreState) => s.myPlayerId;
export const selectMyRole = (s: GameStoreState) => s.myRole;

/** 내 Player 객체 */
export const selectMyPlayer = (s: GameStoreState): Player | undefined =>
  s.players.find((p) => p.id === s.myPlayerId);

/** 내가 호스트인지 */
export const selectAmIHost = (s: GameStoreState): boolean =>
  s.players.some((p) => p.id === s.myPlayerId && p.isHost);

/** 생존 플레이어 목록 */
export const selectAlivePlayers = (s: GameStoreState): Player[] =>
  s.players.filter((p) => p.isAlive);

/** 플레이어 수 */
export const selectPlayerCount = (s: GameStoreState): number => s.players.length;

/** 모든 플레이어가 준비 완료했는지 (호스트 제외) */
export const selectAllReady = (s: GameStoreState): boolean =>
  s.players.filter((p) => !p.isHost).every((p) => p.isReady);
