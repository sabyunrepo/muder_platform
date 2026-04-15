import { describe, it, expect, beforeEach } from "vitest";
import type { PlayerRole } from "@mmp/shared";

import { useGameSessionStore } from "../gameSessionStore";
import {
  selectMyPlayer,
  selectAmIHost,
  selectAlivePlayers,
  selectAllReady,
  selectPlayerCount,
} from "../gameSelectors";
import { makePlayer } from "./gameSessionStore.test";

// ---------------------------------------------------------------------------
// Selector tests
// ---------------------------------------------------------------------------

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

describe("gameSelectors", () => {
  beforeEach(() => {
    useGameSessionStore.setState(BLANK_STATE);
  });

  describe("selectMyPlayer", () => {
    it("내 Player 객체를 반환한다", () => {
      const me = makePlayer({ id: "p1" });
      useGameSessionStore.setState({ players: [me], myPlayerId: "p1" });
      expect(selectMyPlayer(useGameSessionStore.getState())).toEqual(me);
    });

    it("myPlayerId가 없으면 undefined를 반환한다", () => {
      useGameSessionStore.setState({ players: [makePlayer()], myPlayerId: null });
      expect(selectMyPlayer(useGameSessionStore.getState())).toBeUndefined();
    });

    it("해당 ID가 없으면 undefined를 반환한다", () => {
      useGameSessionStore.setState({ players: [makePlayer({ id: "p1" })], myPlayerId: "p99" });
      expect(selectMyPlayer(useGameSessionStore.getState())).toBeUndefined();
    });
  });

  describe("selectAmIHost", () => {
    it("내가 호스트면 true", () => {
      useGameSessionStore.setState({
        players: [makePlayer({ id: "p1", isHost: true })],
        myPlayerId: "p1",
      });
      expect(selectAmIHost(useGameSessionStore.getState())).toBe(true);
    });

    it("내가 호스트가 아니면 false", () => {
      useGameSessionStore.setState({
        players: [makePlayer({ id: "p1", isHost: false })],
        myPlayerId: "p1",
      });
      expect(selectAmIHost(useGameSessionStore.getState())).toBe(false);
    });

    it("myPlayerId가 없으면 false", () => {
      useGameSessionStore.setState({
        players: [makePlayer({ id: "p1", isHost: true })],
        myPlayerId: null,
      });
      expect(selectAmIHost(useGameSessionStore.getState())).toBe(false);
    });
  });

  describe("selectAlivePlayers", () => {
    it("생존 플레이어만 반환한다", () => {
      useGameSessionStore.setState({
        players: [
          makePlayer({ id: "p1", isAlive: true }),
          makePlayer({ id: "p2", isAlive: false }),
          makePlayer({ id: "p3", isAlive: true }),
        ],
      });
      const alive = selectAlivePlayers(useGameSessionStore.getState());
      expect(alive).toHaveLength(2);
      expect(alive.map((p) => p.id)).toEqual(["p1", "p3"]);
    });

    it("모두 사망이면 빈 배열을 반환한다", () => {
      useGameSessionStore.setState({
        players: [makePlayer({ id: "p1", isAlive: false })],
      });
      expect(selectAlivePlayers(useGameSessionStore.getState())).toEqual([]);
    });
  });

  describe("selectAllReady", () => {
    it("호스트 제외 전원 준비 완료면 true", () => {
      useGameSessionStore.setState({
        players: [
          makePlayer({ id: "host", isHost: true, isReady: false }),
          makePlayer({ id: "p1", isReady: true }),
        ],
      });
      expect(selectAllReady(useGameSessionStore.getState())).toBe(true);
    });

    it("준비 안 한 플레이어가 있으면 false", () => {
      useGameSessionStore.setState({
        players: [
          makePlayer({ id: "p1", isReady: true }),
          makePlayer({ id: "p2", isReady: false }),
        ],
      });
      expect(selectAllReady(useGameSessionStore.getState())).toBe(false);
    });

    it("비호스트가 없으면 true (vacuous)", () => {
      useGameSessionStore.setState({
        players: [makePlayer({ id: "host", isHost: true, isReady: false })],
      });
      expect(selectAllReady(useGameSessionStore.getState())).toBe(true);
    });
  });

  describe("selectPlayerCount", () => {
    it("플레이어 수를 반환한다", () => {
      useGameSessionStore.setState({
        players: [makePlayer({ id: "p1" }), makePlayer({ id: "p2" })],
      });
      expect(selectPlayerCount(useGameSessionStore.getState())).toBe(2);
    });

    it("빈 배열이면 0을 반환한다", () => {
      useGameSessionStore.setState({ players: [] });
      expect(selectPlayerCount(useGameSessionStore.getState())).toBe(0);
    });
  });
});
