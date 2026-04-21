/**
 * useGameSync — WS event → store 통합 테스트
 *
 * Phase 19 PR-7 회귀 테스트 (T2):
 *  - useWsEvent를 mock하여 이벤트 핸들러를 직접 캡처한다.
 *  - 각 WS 이벤트를 시뮬레이션하고 gameSessionStore / moduleStoreFactory 상태를 검증한다.
 *  - MSW/WsClient 레이어 없이 순수 unit 수준으로 격리한다.
 *
 * 커버 케이스:
 *  1. session:state → hydrateFromSnapshot → 전체 상태 복원
 *  2. phase.advanced  → setPhase → phase/deadline/round 갱신
 *  3. game:start      → initGame + myPlayerId 주입
 *  4. game:end        → resetGame + 모듈 스토어 정리
 *  5. player.joined   → addPlayer → players 배열 추가
 *  6. player.left     → removePlayer → players 배열에서 제거
 *  7. module:state    → getModuleStore().setData
 *  8. module:event    → getModuleStore().mergeData
 */
import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { renderHook } from "@testing-library/react";
import type { GamePhase, GameState, Player } from "@mmp/shared";
import { WsEventType } from "@mmp/shared";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@mmp/game-logic", () => ({
  syncServerTime: vi.fn(),
}));

// useWsEvent를 mock하여 이벤트 핸들러를 캡처한다.
// 캡처된 핸들러 맵: eventType → handler
const capturedHandlers = new Map<string, (payload: unknown) => void>();

vi.mock("@/hooks/useWsEvent", () => ({
  useWsEvent: vi.fn(
    (
      _endpoint: string,
      eventType: string,
      handler: (payload: unknown) => void,
    ) => {
      capturedHandlers.set(eventType, handler);
    },
  ),
}));

// useAuthStore mock — myId 고정
vi.mock("@/stores/authStore", () => ({
  useAuthStore: vi.fn((selector: (s: { user: { id: string } | null }) => unknown) =>
    selector({ user: { id: "player-me" } }),
  ),
}));

// ---------------------------------------------------------------------------
// Imports (mock 등록 후)
// ---------------------------------------------------------------------------

import { useGameSync } from "../useGameSync";
import { useGameSessionStore } from "@/stores/gameSessionStore";
import { getModuleStore } from "@/stores/moduleStoreFactory";
import { clearModuleStores } from "@/stores/moduleStoreCleanup";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SESSION_ID = "session-test-001";

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

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    sessionId: SESSION_ID,
    phase: "lobby" as GamePhase,
    players: [makePlayer({ id: "player-me" })],
    modules: [],
    round: 1,
    phaseDeadline: null,
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

/** 캡처된 핸들러를 호출하는 헬퍼 */
function emit(eventType: WsEventType, payload: unknown): void {
  const handler = capturedHandlers.get(eventType);
  if (!handler) throw new Error(`No handler captured for event: ${eventType}`);
  handler(payload);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  capturedHandlers.clear();
  // sessionId를 미리 설정하여 module:state/event 핸들러의 namespace가 일치하도록 한다.
  // useGameSync 내 sessionId는 selector로 바인딩되므로 hook 렌더 전에 세팅해야 한다.
  useGameSessionStore.setState({ ...BLANK_STATE, sessionId: SESSION_ID });
  clearModuleStores();
  // hook을 렌더링하여 모든 useWsEvent 핸들러를 등록한다.
  renderHook(() => useGameSync());
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useGameSync — WS event → store 통합", () => {
  // 1. session:state
  it("SESSION_STATE 수신 → hydrateFromSnapshot → 전체 상태 복원", () => {
    const state = makeGameState({ phase: "investigation" as GamePhase, round: 3 });
    emit(WsEventType.SESSION_STATE, { state, ts: Date.now() });

    const s = useGameSessionStore.getState();
    expect(s.sessionId).toBe(SESSION_ID);
    expect(s.phase).toBe("investigation");
    expect(s.round).toBe(3);
    expect(s.isGameActive).toBe(true);
    expect(s.players).toHaveLength(1);
  });

  // 2. phase.advanced
  it("PHASE_ADVANCED 수신 → setPhase → phase/deadline/round 갱신", () => {
    const deadline = Date.now() + 60_000;
    emit(WsEventType.PHASE_ADVANCED, {
      phase: "voting" as GamePhase,
      deadline,
      round: 2,
      ts: Date.now(),
    });

    const s = useGameSessionStore.getState();
    expect(s.phase).toBe("voting");
    expect(s.phaseDeadline).toBe(deadline);
    expect(s.round).toBe(2);
  });

  // 3. game:start
  it("GAME_START 수신 → initGame → isGameActive=true + myPlayerId 주입", () => {
    const state = makeGameState();
    emit(WsEventType.GAME_START, { state, ts: Date.now() });

    const s = useGameSessionStore.getState();
    expect(s.isGameActive).toBe(true);
    expect(s.myPlayerId).toBe("player-me");
    expect(s.sessionId).toBe(SESSION_ID);
  });

  // 4. game:end
  it("GAME_END 수신 → resetGame → 상태 초기화", () => {
    // 먼저 게임 시작 상태로 설정
    useGameSessionStore.getState().initGame(makeGameState(), "player-me");
    expect(useGameSessionStore.getState().isGameActive).toBe(true);

    emit(WsEventType.GAME_END, { ts: Date.now() });

    const s = useGameSessionStore.getState();
    expect(s.isGameActive).toBe(false);
    expect(s.sessionId).toBeNull();
    expect(s.phase).toBeNull();
  });

  // 5. player.joined
  it("PLAYER_JOINED 수신 → addPlayer → players 배열에 추가", () => {
    useGameSessionStore.setState({ players: [] });

    const newPlayer = makePlayer({ id: "p2", nickname: "Bob" });
    emit(WsEventType.PLAYER_JOINED, { player: newPlayer, ts: Date.now() });

    const players = useGameSessionStore.getState().players;
    expect(players).toHaveLength(1);
    expect(players[0].id).toBe("p2");
    expect(players[0].nickname).toBe("Bob");
  });

  // 6. player.left
  it("PLAYER_LEFT 수신 → removePlayer → players 배열에서 제거", () => {
    useGameSessionStore.setState({
      players: [makePlayer({ id: "p1" }), makePlayer({ id: "p2" })],
    });

    emit(WsEventType.PLAYER_LEFT, { playerId: "p1", ts: Date.now() });

    const players = useGameSessionStore.getState().players;
    expect(players).toHaveLength(1);
    expect(players[0].id).toBe("p2");
  });

  // 7. module:state
  it("MODULE_STATE 수신 → getModuleStore().setData → 모듈 데이터 전체 교체", () => {
    emit(WsEventType.MODULE_STATE, {
      moduleId: "voting",
      data: { votes: { p1: "p2" } },
      ts: Date.now(),
    });

    const store = getModuleStore("voting", SESSION_ID);
    expect(store.getState().data).toEqual({ votes: { p1: "p2" } });
  });

  // 8. module:event
  it("MODULE_EVENT 수신 → getModuleStore().mergeData → 모듈 데이터 병합", () => {
    // 초기 데이터 세팅
    getModuleStore("clue", SESSION_ID).getState().setData({ existing: true });

    emit(WsEventType.MODULE_EVENT, {
      moduleId: "clue",
      data: { newField: 42 },
      ts: Date.now(),
    });

    const data = getModuleStore("clue", SESSION_ID).getState().data;
    expect(data).toMatchObject({ existing: true, newField: 42 });
  });
});

describe("useGameSync — 연속 이벤트 시나리오", () => {
  it("GAME_START → PHASE_ADVANCED → PLAYER_JOINED 순차 처리", () => {
    emit(WsEventType.GAME_START, { state: makeGameState(), ts: Date.now() });
    emit(WsEventType.PHASE_ADVANCED, {
      phase: "investigation" as GamePhase,
      deadline: null,
      round: 1,
      ts: Date.now(),
    });
    emit(WsEventType.PLAYER_JOINED, {
      player: makePlayer({ id: "p3", nickname: "Charlie" }),
      ts: Date.now(),
    });

    const s = useGameSessionStore.getState();
    expect(s.isGameActive).toBe(true);
    expect(s.phase).toBe("investigation");
    // 초기 player(player-me) + p3
    expect(s.players.some((p) => p.id === "p3")).toBe(true);
  });

  it("SESSION_STATE 이중 hydrate → 최신 상태로 덮어쓴다", () => {
    emit(WsEventType.SESSION_STATE, {
      state: makeGameState({ sessionId: "old-session", round: 1 }),
      ts: Date.now(),
    });
    emit(WsEventType.SESSION_STATE, {
      state: makeGameState({ sessionId: SESSION_ID, round: 5 }),
      ts: Date.now(),
    });

    const s = useGameSessionStore.getState();
    expect(s.sessionId).toBe(SESSION_ID);
    expect(s.round).toBe(5);
  });
});
