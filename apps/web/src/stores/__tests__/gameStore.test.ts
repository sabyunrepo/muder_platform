import { describe, it, expect, beforeEach, vi } from "vitest";
import type { GamePhase, GameState, ModuleConfig, Player, PlayerRole } from "@mmp/shared";

vi.mock("@mmp/game-logic", () => ({
  syncServerTime: vi.fn(),
}));

// mock 이후 import해야 mock이 적용됨
import { syncServerTime } from "@mmp/game-logic";
import {
  useGameStore,
  selectMyPlayer,
  selectAmIHost,
  selectAlivePlayers,
  selectAllReady,
} from "../gameStore";

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

function makeGameState(overrides: Partial<GameState> = {}): GameState {
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("gameStore", () => {
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

  // -------------------------------------------------------------------------
  // 초기 상태
  // -------------------------------------------------------------------------

  describe("초기 상태", () => {
    it("sessionId는 null이다", () => {
      expect(useGameStore.getState().sessionId).toBeNull();
    });

    it("phase는 null이다", () => {
      expect(useGameStore.getState().phase).toBeNull();
    });

    it("players는 빈 배열이다", () => {
      expect(useGameStore.getState().players).toEqual([]);
    });

    it("modules는 빈 배열이다", () => {
      expect(useGameStore.getState().modules).toEqual([]);
    });

    it("round는 0이다", () => {
      expect(useGameStore.getState().round).toBe(0);
    });

    it("phaseDeadline은 null이다", () => {
      expect(useGameStore.getState().phaseDeadline).toBeNull();
    });

    it("isGameActive는 false이다", () => {
      expect(useGameStore.getState().isGameActive).toBe(false);
    });

    it("myPlayerId는 null이다", () => {
      expect(useGameStore.getState().myPlayerId).toBeNull();
    });

    it("myRole는 null이다", () => {
      expect(useGameStore.getState().myRole).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // initGame
  // -------------------------------------------------------------------------

  describe("initGame", () => {
    it("전체 상태를 설정한다", () => {
      const gs = makeGameState();
      useGameStore.getState().initGame(gs, "p1");

      const s = useGameStore.getState();
      expect(s.sessionId).toBe("session-1");
      expect(s.phase).toBe("lobby");
      expect(s.players).toEqual(gs.players);
      expect(s.modules).toEqual(gs.modules);
      expect(s.round).toBe(1);
      expect(s.phaseDeadline).toBe(9999);
      expect(s.myPlayerId).toBe("p1");
    });

    it("isGameActive를 true로 설정한다", () => {
      useGameStore.getState().initGame(makeGameState(), "p1");
      expect(useGameStore.getState().isGameActive).toBe(true);
    });

    it("myRole을 players에서 추출한다", () => {
      const gs = makeGameState({
        players: [makePlayer({ id: "p1", role: "detective" as PlayerRole })],
      });
      useGameStore.getState().initGame(gs, "p1");
      expect(useGameStore.getState().myRole).toBe("detective");
    });

    it("myPlayerId가 players에 없으면 myRole은 null이다", () => {
      useGameStore.getState().initGame(makeGameState(), "unknown");
      expect(useGameStore.getState().myRole).toBeNull();
    });

    it("syncServerTime을 호출한다", () => {
      const gs = makeGameState();
      useGameStore.getState().initGame(gs, "p1");
      expect(syncServerTime).toHaveBeenCalledWith(gs.createdAt);
    });
  });

  // -------------------------------------------------------------------------
  // resetGame
  // -------------------------------------------------------------------------

  describe("resetGame", () => {
    it("초기 상태로 복원한다", () => {
      useGameStore.getState().initGame(makeGameState(), "p1");
      useGameStore.getState().resetGame();

      const s = useGameStore.getState();
      expect(s.sessionId).toBeNull();
      expect(s.phase).toBeNull();
      expect(s.players).toEqual([]);
      expect(s.modules).toEqual([]);
      expect(s.round).toBe(0);
      expect(s.phaseDeadline).toBeNull();
      expect(s.isGameActive).toBe(false);
      expect(s.myPlayerId).toBeNull();
      expect(s.myRole).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // setPhase
  // -------------------------------------------------------------------------

  describe("setPhase", () => {
    it("phase를 업데이트한다", () => {
      useGameStore.getState().setPhase("investigation" as GamePhase, 5000, 2);
      expect(useGameStore.getState().phase).toBe("investigation");
    });

    it("phaseDeadline을 업데이트한다", () => {
      useGameStore.getState().setPhase("investigation" as GamePhase, 5000, 2);
      expect(useGameStore.getState().phaseDeadline).toBe(5000);
    });

    it("round를 업데이트한다", () => {
      useGameStore.getState().setPhase("investigation" as GamePhase, 5000, 2);
      expect(useGameStore.getState().round).toBe(2);
    });

    it("deadline이 null일 수 있다", () => {
      useGameStore.getState().setPhase("lobby" as GamePhase, null, 0);
      expect(useGameStore.getState().phaseDeadline).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // setPlayers
  // -------------------------------------------------------------------------

  describe("setPlayers", () => {
    it("players를 설정한다", () => {
      const players = [makePlayer({ id: "p1" }), makePlayer({ id: "p2", nickname: "Bob" })];
      useGameStore.getState().setPlayers(players);
      expect(useGameStore.getState().players).toEqual(players);
    });

    it("myRole을 재계산한다", () => {
      useGameStore.setState({ myPlayerId: "p1" });
      const players = [makePlayer({ id: "p1", role: "murderer" as PlayerRole })];
      useGameStore.getState().setPlayers(players);
      expect(useGameStore.getState().myRole).toBe("murderer");
    });

    it("myPlayerId가 players에 없으면 myRole은 null이다", () => {
      useGameStore.setState({ myPlayerId: "unknown" });
      useGameStore.getState().setPlayers([makePlayer({ id: "p1" })]);
      expect(useGameStore.getState().myRole).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // addPlayer
  // -------------------------------------------------------------------------

  describe("addPlayer", () => {
    it("플레이어를 추가한다", () => {
      useGameStore.getState().addPlayer(makePlayer({ id: "p1" }));
      expect(useGameStore.getState().players).toHaveLength(1);
      expect(useGameStore.getState().players[0].id).toBe("p1");
    });

    it("중복 ID면 기존 플레이어를 교체한다", () => {
      useGameStore.getState().addPlayer(makePlayer({ id: "p1", nickname: "Alice" }));
      useGameStore.getState().addPlayer(makePlayer({ id: "p1", nickname: "Alice2" }));

      const players = useGameStore.getState().players;
      expect(players).toHaveLength(1);
      expect(players[0].nickname).toBe("Alice2");
    });

    it("다른 ID면 추가한다", () => {
      useGameStore.getState().addPlayer(makePlayer({ id: "p1" }));
      useGameStore.getState().addPlayer(makePlayer({ id: "p2", nickname: "Bob" }));
      expect(useGameStore.getState().players).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // removePlayer
  // -------------------------------------------------------------------------

  describe("removePlayer", () => {
    it("플레이어를 제거한다", () => {
      useGameStore.setState({
        players: [makePlayer({ id: "p1" }), makePlayer({ id: "p2" })],
      });
      useGameStore.getState().removePlayer("p1");
      expect(useGameStore.getState().players).toHaveLength(1);
      expect(useGameStore.getState().players[0].id).toBe("p2");
    });

    it("myRole을 재계산한다", () => {
      useGameStore.setState({
        players: [makePlayer({ id: "p1", role: "detective" as PlayerRole })],
        myPlayerId: "p1",
        myRole: "detective" as PlayerRole,
      });
      useGameStore.getState().removePlayer("p1");
      expect(useGameStore.getState().myRole).toBeNull();
    });

    it("존재하지 않는 ID를 제거해도 에러 없다", () => {
      useGameStore.setState({ players: [makePlayer({ id: "p1" })] });
      useGameStore.getState().removePlayer("nonexistent");
      expect(useGameStore.getState().players).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // updateModuleState
  // -------------------------------------------------------------------------

  describe("updateModuleState", () => {
    it("특정 모듈의 settings를 머지한다", () => {
      useGameStore.setState({
        modules: [makeModule({ id: "mod-1", settings: { a: 1 } })],
      });
      useGameStore.getState().updateModuleState("mod-1", { b: 2 });

      const mod = useGameStore.getState().modules.find((m) => m.id === "mod-1");
      expect(mod?.settings).toEqual({ a: 1, b: 2 });
    });

    it("기존 settings 값을 덮어쓴다", () => {
      useGameStore.setState({
        modules: [makeModule({ id: "mod-1", settings: { a: 1 } })],
      });
      useGameStore.getState().updateModuleState("mod-1", { a: 99 });

      const mod = useGameStore.getState().modules.find((m) => m.id === "mod-1");
      expect(mod?.settings).toEqual({ a: 99 });
    });

    it("다른 모듈에는 영향 없다", () => {
      useGameStore.setState({
        modules: [
          makeModule({ id: "mod-1", settings: { a: 1 } }),
          makeModule({ id: "mod-2", settings: { x: 10 } }),
        ],
      });
      useGameStore.getState().updateModuleState("mod-1", { b: 2 });

      const mod2 = useGameStore.getState().modules.find((m) => m.id === "mod-2");
      expect(mod2?.settings).toEqual({ x: 10 });
    });
  });

  // -------------------------------------------------------------------------
  // setGameState
  // -------------------------------------------------------------------------

  describe("setGameState", () => {
    it("전체 상태를 덮어쓴다", () => {
      useGameStore.setState({ myPlayerId: "p1" });

      const gs = makeGameState({
        sessionId: "session-2",
        phase: "voting" as GamePhase,
        round: 3,
      });
      useGameStore.getState().setGameState(gs);

      const s = useGameStore.getState();
      expect(s.sessionId).toBe("session-2");
      expect(s.phase).toBe("voting");
      expect(s.round).toBe(3);
      expect(s.isGameActive).toBe(true);
    });

    it("기존 myPlayerId를 유지하면서 myRole을 재계산한다", () => {
      useGameStore.setState({ myPlayerId: "p1" });

      const gs = makeGameState({
        players: [makePlayer({ id: "p1", role: "civilian" as PlayerRole })],
      });
      useGameStore.getState().setGameState(gs);
      expect(useGameStore.getState().myRole).toBe("civilian");
    });

    it("syncServerTime을 호출한다", () => {
      const gs = makeGameState();
      useGameStore.getState().setGameState(gs);
      expect(syncServerTime).toHaveBeenCalledWith(gs.createdAt);
    });
  });

  // -------------------------------------------------------------------------
  // Selectors
  // -------------------------------------------------------------------------

  describe("selectors", () => {
    describe("selectMyPlayer", () => {
      it("내 Player 객체를 반환한다", () => {
        const me = makePlayer({ id: "p1", nickname: "Me" });
        useGameStore.setState({ players: [me, makePlayer({ id: "p2" })], myPlayerId: "p1" });
        expect(selectMyPlayer(useGameStore.getState())).toEqual(me);
      });

      it("myPlayerId가 없으면 undefined를 반환한다", () => {
        useGameStore.setState({ players: [makePlayer()], myPlayerId: null });
        expect(selectMyPlayer(useGameStore.getState())).toBeUndefined();
      });
    });

    describe("selectAmIHost", () => {
      it("내가 호스트면 true를 반환한다", () => {
        useGameStore.setState({
          players: [makePlayer({ id: "p1", isHost: true })],
          myPlayerId: "p1",
        });
        expect(selectAmIHost(useGameStore.getState())).toBe(true);
      });

      it("내가 호스트가 아니면 false를 반환한다", () => {
        useGameStore.setState({
          players: [makePlayer({ id: "p1", isHost: false })],
          myPlayerId: "p1",
        });
        expect(selectAmIHost(useGameStore.getState())).toBe(false);
      });

      it("myPlayerId가 없으면 false를 반환한다", () => {
        useGameStore.setState({ players: [makePlayer({ id: "p1", isHost: true })], myPlayerId: null });
        expect(selectAmIHost(useGameStore.getState())).toBe(false);
      });
    });

    describe("selectAlivePlayers", () => {
      it("생존 플레이어만 반환한다", () => {
        useGameStore.setState({
          players: [
            makePlayer({ id: "p1", isAlive: true }),
            makePlayer({ id: "p2", isAlive: false }),
            makePlayer({ id: "p3", isAlive: true }),
          ],
        });
        const alive = selectAlivePlayers(useGameStore.getState());
        expect(alive).toHaveLength(2);
        expect(alive.map((p) => p.id)).toEqual(["p1", "p3"]);
      });

      it("모두 사망이면 빈 배열을 반환한다", () => {
        useGameStore.setState({
          players: [makePlayer({ id: "p1", isAlive: false })],
        });
        expect(selectAlivePlayers(useGameStore.getState())).toEqual([]);
      });
    });

    describe("selectAllReady", () => {
      it("호스트 제외 전원 준비 완료면 true를 반환한다", () => {
        useGameStore.setState({
          players: [
            makePlayer({ id: "host", isHost: true, isReady: false }),
            makePlayer({ id: "p1", isReady: true }),
            makePlayer({ id: "p2", isReady: true }),
          ],
        });
        expect(selectAllReady(useGameStore.getState())).toBe(true);
      });

      it("한 명이라도 준비 안 하면 false를 반환한다", () => {
        useGameStore.setState({
          players: [
            makePlayer({ id: "host", isHost: true }),
            makePlayer({ id: "p1", isReady: true }),
            makePlayer({ id: "p2", isReady: false }),
          ],
        });
        expect(selectAllReady(useGameStore.getState())).toBe(false);
      });

      it("호스트만 있으면 true를 반환한다 (비호스트가 없으므로 vacuous truth)", () => {
        useGameStore.setState({
          players: [makePlayer({ id: "host", isHost: true, isReady: false })],
        });
        expect(selectAllReady(useGameStore.getState())).toBe(true);
      });
    });
  });
});
