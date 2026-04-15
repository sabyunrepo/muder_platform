import type { WsClient } from "@mmp/ws-client";
import { WsEventType } from "@mmp/shared";
import type { GamePhase, GameState, Player } from "@mmp/shared";
import { useGameSessionStore } from "./gameSessionStore";

// ---------------------------------------------------------------------------
// WS payload types (matching Go server envelope)
// ---------------------------------------------------------------------------

interface PhaseChangedPayload {
  phase: GamePhase;
  deadline: number | null;
  round: number;
}

interface PlayerJoinedPayload {
  player: Player;
}

interface PlayerLeftPayload {
  playerId: string;
}

interface ModuleEventPayload {
  moduleId: string;
  event: string;
  data: Record<string, unknown>;
}

interface ModuleStatePayload {
  moduleId: string;
  settings: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Handler registration
// ---------------------------------------------------------------------------

/**
 * Registers all game-related WS message handlers on the given client.
 * Returns a cleanup function that removes all listeners.
 */
export function registerGameHandlers(client: WsClient): () => void {
  const store = useGameSessionStore.getState;

  const unsubPhaseChange = client.on<PhaseChangedPayload>(
    WsEventType.GAME_PHASE_CHANGE,
    (payload) => {
      store().setPhase(payload.phase, payload.deadline, payload.round);
    },
  );

  const unsubGameState = client.on<GameState>(
    WsEventType.SESSION_STATE,
    (payload) => {
      store().setGameState(payload);
    },
  );

  const unsubPlayerJoined = client.on<PlayerJoinedPayload>(
    WsEventType.SESSION_PLAYER_JOINED,
    (payload) => {
      store().addPlayer(payload.player);
    },
  );

  const unsubPlayerLeft = client.on<PlayerLeftPayload>(
    WsEventType.SESSION_PLAYER_LEFT,
    (payload) => {
      store().removePlayer(payload.playerId);
    },
  );

  const unsubModuleEvent = client.on<ModuleEventPayload>(
    WsEventType.MODULE_EVENT,
    (payload) => {
      // Module events carry arbitrary data — stored as settings update
      store().updateModuleState(payload.moduleId, { lastEvent: payload });
    },
  );

  const unsubModuleState = client.on<ModuleStatePayload>(
    WsEventType.MODULE_STATE,
    (payload) => {
      store().updateModuleState(payload.moduleId, payload.settings);
    },
  );

  const unsubGameEnd = client.on<GameState>(
    WsEventType.GAME_END,
    (payload) => {
      store().setGameState(payload);
    },
  );

  return () => {
    unsubPhaseChange();
    unsubGameState();
    unsubPlayerJoined();
    unsubPlayerLeft();
    unsubModuleEvent();
    unsubModuleState();
    unsubGameEnd();
  };
}
