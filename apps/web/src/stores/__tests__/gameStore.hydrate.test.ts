import { describe, it, expect, beforeEach, vi } from "vitest";
import type { GamePhase, GameState, Player, ModuleConfig } from "@mmp/shared";

vi.mock("@mmp/game-logic", () => ({
  syncServerTime: vi.fn(),
}));

import { syncServerTime } from "@mmp/game-logic";
import { useGameStore } from "../gameStore";

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("gameStore.hydrateFromSnapshot", () => {
  beforeEach(() => {
    useGameStore.setState({
      sessionId: null,
      phase: null,
      players: [],
      modules: [],
      round: 0,
      phaseDeadline: null,
      isGameActive: false,
      myPlayerId: null,
      myRole: null,
    });
    vi.clearAllMocks();
  });

  it("sets all game state fields from snapshot", () => {
    const state = makeState();
    useGameStore.getState().hydrateFromSnapshot(state);

    const s = useGameStore.getState();
    expect(s.sessionId).toBe("session-hydrate");
    expect(s.phase).toBe("investigation");
    expect(s.players).toEqual(state.players);
    expect(s.modules).toEqual(state.modules);
    expect(s.round).toBe(3);
    expect(s.phaseDeadline).toBe(9999);
    expect(s.isGameActive).toBe(true);
  });

  it("preserves myPlayerId from existing store state", () => {
    useGameStore.setState({ myPlayerId: "p1" });
    const state = makeState({
      players: [makePlayer({ id: "p1", role: "detective" as const })],
    });
    useGameStore.getState().hydrateFromSnapshot(state);

    const s = useGameStore.getState();
    expect(s.myPlayerId).toBe("p1");
    expect(s.myRole).toBe("detective");
  });

  it("extracts myRole as null when myPlayerId is null", () => {
    const state = makeState();
    useGameStore.getState().hydrateFromSnapshot(state);

    expect(useGameStore.getState().myRole).toBeNull();
  });

  it("calls syncServerTime with createdAt", () => {
    const state = makeState({ createdAt: 123456789 });
    useGameStore.getState().hydrateFromSnapshot(state);

    expect(syncServerTime).toHaveBeenCalledWith(123456789);
  });

  it("replaces previous state fully on second hydration", () => {
    useGameStore.getState().hydrateFromSnapshot(makeState({ sessionId: "old" }));
    useGameStore.getState().hydrateFromSnapshot(makeState({ sessionId: "new", round: 7 }));

    const s = useGameStore.getState();
    expect(s.sessionId).toBe("new");
    expect(s.round).toBe(7);
  });

  it("is behaviourally identical to setGameState", () => {
    const state = makeState();

    const store = useGameStore.getState();
    store.hydrateFromSnapshot(state);
    const afterHydrate = { ...useGameStore.getState() };

    useGameStore.setState({ sessionId: null, phase: null, players: [], modules: [], round: 0, phaseDeadline: null, isGameActive: false, myPlayerId: null, myRole: null });

    store.setGameState(state);
    const afterSetGameState = { ...useGameStore.getState() };

    // Compare all domain fields (functions will differ by reference).
    const domainFields = ["sessionId", "phase", "players", "modules", "round", "phaseDeadline", "isGameActive", "myPlayerId", "myRole"] as const;
    for (const field of domainFields) {
      expect(afterHydrate[field]).toEqual(afterSetGameState[field]);
    }
  });
});
