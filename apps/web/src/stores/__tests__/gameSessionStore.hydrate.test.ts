import { describe, it, expect, beforeEach, vi } from "vitest";
import type { GamePhase, GameState, Player, ModuleConfig } from "@mmp/shared";

vi.mock("@mmp/game-logic", () => ({
  syncServerTime: vi.fn(),
}));

import { syncServerTime } from "@mmp/game-logic";
import { useGameSessionStore } from "../gameSessionStore";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p1",
    nickname: "Alice",
    role: null,
    isAlive: true,
    isHost: false,
    isReady: false,
    connectedAt: Date.now(),
    ...overrides,
  };
}

function makeModule(overrides: Partial<ModuleConfig> = {}): ModuleConfig {
  return {
    id: "mod-1",
    name: "TestModule",
    version: "1.0.0",
    enabled: true,
    settings: {},
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    sessionId: "session-hydrate",
    phase: "investigation" as GamePhase,
    players: [makePlayer()],
    modules: [makeModule()],
    round: 3,
    phaseDeadline: 9999,
    createdAt: Date.now(),
    ...overrides,
  };
}

const BLANK_STATE = {
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
// Tests
// ---------------------------------------------------------------------------

describe("gameSessionStore.hydrateFromSnapshot", () => {
  beforeEach(() => {
    useGameSessionStore.setState(BLANK_STATE);
    vi.clearAllMocks();
  });

  it("sets all game state fields from snapshot", () => {
    const state = makeState();
    useGameSessionStore.getState().hydrateFromSnapshot(state);

    const s = useGameSessionStore.getState();
    expect(s.sessionId).toBe("session-hydrate");
    expect(s.phase).toBe("investigation");
    expect(s.players).toEqual(state.players);
    expect(s.modules).toEqual(state.modules);
    expect(s.round).toBe(3);
    expect(s.phaseDeadline).toBe(9999);
    expect(s.isGameActive).toBe(true);
  });

  it("preserves myPlayerId from existing store state", () => {
    useGameSessionStore.setState({ myPlayerId: "p1" });
    const state = makeState({
      players: [makePlayer({ id: "p1", role: "detective" as const })],
    });
    useGameSessionStore.getState().hydrateFromSnapshot(state);

    const s = useGameSessionStore.getState();
    expect(s.myPlayerId).toBe("p1");
    expect(s.myRole).toBe("detective");
  });

  it("extracts myRole as null when myPlayerId is null", () => {
    const state = makeState();
    useGameSessionStore.getState().hydrateFromSnapshot(state);

    expect(useGameSessionStore.getState().myRole).toBeNull();
  });

  it("calls syncServerTime with createdAt on hydrate", () => {
    const state = makeState({ createdAt: 123456789 });
    useGameSessionStore.getState().hydrateFromSnapshot(state);

    expect(syncServerTime).toHaveBeenCalledWith(123456789);
  });

  it("calls syncServerTime on initGame", () => {
    const state = makeState({ createdAt: 111 });
    useGameSessionStore.getState().initGame(state, "p1");
    expect(syncServerTime).toHaveBeenCalledWith(111);
  });

  it("calls syncServerTime on setGameState", () => {
    const state = makeState({ createdAt: 222 });
    useGameSessionStore.getState().setGameState(state);
    expect(syncServerTime).toHaveBeenCalledWith(222);
  });

  it("replaces previous state fully on second hydration", () => {
    useGameSessionStore.getState().hydrateFromSnapshot(makeState({ sessionId: "old" }));
    useGameSessionStore.getState().hydrateFromSnapshot(makeState({ sessionId: "new", round: 7 }));

    const s = useGameSessionStore.getState();
    expect(s.sessionId).toBe("new");
    expect(s.round).toBe(7);
  });

  it("is behaviourally identical to setGameState", () => {
    const state = makeState();
    const store = useGameSessionStore.getState();

    store.hydrateFromSnapshot(state);
    const afterHydrate = { ...useGameSessionStore.getState() };

    useGameSessionStore.setState(BLANK_STATE);
    store.setGameState(state);
    const afterSetGameState = { ...useGameSessionStore.getState() };

    const domainFields = [
      "sessionId",
      "phase",
      "players",
      "modules",
      "round",
      "phaseDeadline",
      "isGameActive",
      "myPlayerId",
      "myRole",
    ] as const;
    for (const field of domainFields) {
      expect(afterHydrate[field]).toEqual(afterSetGameState[field]);
    }
  });
});
