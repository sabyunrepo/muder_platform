import { describe, it, expect, beforeEach } from "vitest";
import type { GamePhase, GameState, ModuleConfig, Player, PlayerRole } from "@mmp/shared";

import { useGameSessionStore } from "../gameSessionStore";
import {
  selectMyPlayer,
  selectAmIHost,
  selectAlivePlayers,
  selectAllReady,
  selectPlayerCount,
} from "../gameSelectors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function makePlayer(overrides: Partial<Player> = {}): Player {
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

export function makeModule(overrides: Partial<ModuleConfig> = {}): ModuleConfig {
  return {
    id: "mod-1",
    name: "TestModule",
    version: "1.0.0",
    enabled: true,
    settings: {},
    ...overrides,
  };
}

export function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    sessionId: "session-1",
    phase: "lobby" as GamePhase,
    players: [makePlayer()],
    modules: [makeModule()],
    round: 1,
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
// Store action tests
// ---------------------------------------------------------------------------

describe("gameSessionStore — actions", () => {
  beforeEach(() => {
    useGameSessionStore.setState(BLANK_STATE);
  });

  describe("초기 상태", () => {
    it("sessionId는 null이다", () => {
      expect(useGameSessionStore.getState().sessionId).toBeNull();
    });

    it("phase는 null이다", () => {
      expect(useGameSessionStore.getState().phase).toBeNull();
    });

    it("isGameActive는 false이다", () => {
      expect(useGameSessionStore.getState().isGameActive).toBe(false);
    });
  });

  describe("initGame", () => {
    it("전체 상태를 설정한다", () => {
      const gs = makeGameState();
      useGameSessionStore.getState().initGame(gs, "p1");

      const s = useGameSessionStore.getState();
      expect(s.sessionId).toBe("session-1");
      expect(s.phase).toBe("lobby");
      expect(s.round).toBe(1);
      expect(s.phaseDeadline).toBe(9999);
      expect(s.myPlayerId).toBe("p1");
      expect(s.isGameActive).toBe(true);
    });

    it("myRole을 players에서 추출한다", () => {
      const gs = makeGameState({
        players: [makePlayer({ id: "p1", role: "detective" as PlayerRole })],
      });
      useGameSessionStore.getState().initGame(gs, "p1");
      expect(useGameSessionStore.getState().myRole).toBe("detective");
    });

    it("myPlayerId가 players에 없으면 myRole은 null이다", () => {
      useGameSessionStore.getState().initGame(makeGameState(), "unknown");
      expect(useGameSessionStore.getState().myRole).toBeNull();
    });
  });

  describe("resetGame", () => {
    it("초기 상태로 복원한다", () => {
      useGameSessionStore.getState().initGame(makeGameState(), "p1");
      useGameSessionStore.getState().resetGame();

      const s = useGameSessionStore.getState();
      expect(s.sessionId).toBeNull();
      expect(s.phase).toBeNull();
      expect(s.isGameActive).toBe(false);
    });
  });

  describe("setPhase", () => {
    it("phase, deadline, round를 업데이트한다", () => {
      useGameSessionStore.getState().setPhase("investigation" as GamePhase, 5000, 2);
      const s = useGameSessionStore.getState();
      expect(s.phase).toBe("investigation");
      expect(s.phaseDeadline).toBe(5000);
      expect(s.round).toBe(2);
    });

    it("deadline이 null일 수 있다", () => {
      useGameSessionStore.getState().setPhase("lobby" as GamePhase, null, 0);
      expect(useGameSessionStore.getState().phaseDeadline).toBeNull();
    });
  });

  describe("addPlayer / removePlayer", () => {
    it("플레이어를 추가한다", () => {
      useGameSessionStore.getState().addPlayer(makePlayer({ id: "p1" }));
      expect(useGameSessionStore.getState().players).toHaveLength(1);
    });

    it("중복 ID면 교체한다", () => {
      useGameSessionStore.getState().addPlayer(makePlayer({ id: "p1", nickname: "Alice" }));
      useGameSessionStore.getState().addPlayer(makePlayer({ id: "p1", nickname: "Alice2" }));
      expect(useGameSessionStore.getState().players[0].nickname).toBe("Alice2");
    });

    it("플레이어를 제거한다", () => {
      useGameSessionStore.setState({
        players: [makePlayer({ id: "p1" }), makePlayer({ id: "p2" })],
      });
      useGameSessionStore.getState().removePlayer("p1");
      expect(useGameSessionStore.getState().players).toHaveLength(1);
      expect(useGameSessionStore.getState().players[0].id).toBe("p2");
    });

    it("removePlayer시 myRole을 재계산한다", () => {
      useGameSessionStore.setState({
        players: [makePlayer({ id: "p1", role: "detective" as PlayerRole })],
        myPlayerId: "p1",
        myRole: "detective" as PlayerRole,
      });
      useGameSessionStore.getState().removePlayer("p1");
      expect(useGameSessionStore.getState().myRole).toBeNull();
    });
  });

  describe("updateModuleState", () => {
    it("특정 모듈 settings를 머지한다", () => {
      useGameSessionStore.setState({
        modules: [makeModule({ id: "mod-1", settings: { a: 1 } })],
      });
      useGameSessionStore.getState().updateModuleState("mod-1", { b: 2 });
      const mod = useGameSessionStore.getState().modules.find((m) => m.id === "mod-1");
      expect(mod?.settings).toEqual({ a: 1, b: 2 });
    });

    it("다른 모듈에 영향 없다", () => {
      useGameSessionStore.setState({
        modules: [
          makeModule({ id: "mod-1", settings: { a: 1 } }),
          makeModule({ id: "mod-2", settings: { x: 10 } }),
        ],
      });
      useGameSessionStore.getState().updateModuleState("mod-1", { b: 2 });
      const mod2 = useGameSessionStore.getState().modules.find((m) => m.id === "mod-2");
      expect(mod2?.settings).toEqual({ x: 10 });
    });
  });
});
