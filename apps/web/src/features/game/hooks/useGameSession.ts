import { useEffect } from "react";
import { WsEventType } from "@mmp/shared";
import type { GamePhase, GameState, Player } from "@mmp/shared";

import { useAuthStore } from "@/stores/authStore";
import { useGameSessionStore } from "@/stores/gameSessionStore";
import { useWsEvent } from "@/hooks/useWsEvent";

// ---------------------------------------------------------------------------
// WS payload types
// ---------------------------------------------------------------------------

interface PhaseChangedPayload {
  phase: GamePhase;
  deadline: number | null;
  round: number;
}

interface SessionStatePayload {
  state: GameState;
}

interface GameStartPayload {
  state: GameState;
}

interface PlayerJoinedPayload {
  player: Player;
}

interface PlayerLeftPayload {
  playerId: string;
}

interface ModuleStatePayload {
  moduleId: string;
  settings: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Synchronises game WS events into the gameSessionStore.
 * Must be called once in the game session root component.
 */
export function useGameSession(): void {
  const myId = useAuthStore((s) => s.user?.id ?? null);

  // Register my player ID once available
  useEffect(() => {
    if (myId) {
      // No-op: initGame is triggered by GAME_START event
    }
  }, [myId]);

  // game:start — initialise store with full server state
  useWsEvent<GameStartPayload>("game", WsEventType.GAME_START, (payload) => {
    const currentMyId = useAuthStore.getState().user?.id;
    if (currentMyId) {
      useGameSessionStore.getState().initGame(payload.state, currentMyId);
    }
  });

  // session:state — full state sync (reconnect / snapshot)
  useWsEvent<SessionStatePayload>("game", WsEventType.SESSION_STATE, (payload) => {
    useGameSessionStore.getState().setGameState(payload.state);
  });

  // game:phase:change — phase transition
  useWsEvent<PhaseChangedPayload>("game", WsEventType.GAME_PHASE_CHANGE, (payload) => {
    useGameSessionStore.getState().setPhase(payload.phase, payload.deadline, payload.round);
  });

  // game:end — reset session state
  useWsEvent<void>("game", WsEventType.GAME_END, () => {
    useGameSessionStore.getState().resetGame();
  });

  // session:player:joined
  useWsEvent<PlayerJoinedPayload>("game", WsEventType.SESSION_PLAYER_JOINED, (payload) => {
    useGameSessionStore.getState().addPlayer(payload.player);
  });

  // session:player:left
  useWsEvent<PlayerLeftPayload>("game", WsEventType.SESSION_PLAYER_LEFT, (payload) => {
    useGameSessionStore.getState().removePlayer(payload.playerId);
  });

  // module:state — full module settings replacement
  useWsEvent<ModuleStatePayload>("game", WsEventType.MODULE_STATE, (payload) => {
    useGameSessionStore.getState().updateModuleState(payload.moduleId, payload.settings);
  });
}
