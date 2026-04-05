import { WsEventType } from "@mmp/shared";
import type { GamePhase, GameState, Player } from "@mmp/shared";
import { syncServerTime } from "@mmp/game-logic";

import { useAuthStore } from "@/stores/authStore";
import { useGameStore } from "@/stores/gameStore";
import { getModuleStore, clearModuleStores } from "@/stores/moduleStoreFactory";
import { useWsEvent } from "@/hooks/useWsEvent";

// ---------------------------------------------------------------------------
// WS 페이로드 타입
// ---------------------------------------------------------------------------

interface PhaseChangePayload {
  phase: GamePhase;
  deadline: number | null;
  round: number;
  ts: number;
}

interface GameStartPayload {
  state: GameState;
  ts: number;
}

interface GameEndPayload {
  ts: number;
}

interface ModuleStatePayload {
  moduleId: string;
  data: Record<string, unknown>;
  ts: number;
}

interface ModuleEventPayload {
  moduleId: string;
  data: Record<string, unknown>;
  ts: number;
}

interface SessionStatePayload {
  state: GameState;
  ts: number;
}

interface PlayerJoinedPayload {
  player: Player;
  ts: number;
}

interface PlayerLeftPayload {
  playerId: string;
  ts: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * 게임 WS 이벤트를 Zustand 스토어에 동기화하는 hook.
 * 게임 세션에 참여 중인 최상위 컴포넌트에서 한 번만 호출한다.
 */
export function useGameSync(): void {
  // session:state — 전체 게임 상태 동기화
  useWsEvent<SessionStatePayload>("game", WsEventType.SESSION_STATE, (payload) => {
    syncServerTime(payload.ts);
    useGameStore.getState().setGameState(payload.state);
  });

  // game:phase:change — 페이즈 전환
  useWsEvent<PhaseChangePayload>("game", WsEventType.GAME_PHASE_CHANGE, (payload) => {
    syncServerTime(payload.ts);
    useGameStore.getState().setPhase(payload.phase, payload.deadline, payload.round);
  });

  // game:start — 게임 시작, 내 플레이어 ID로 초기화
  useWsEvent<GameStartPayload>("game", WsEventType.GAME_START, (payload) => {
    syncServerTime(payload.ts);
    const myId = useAuthStore.getState().user?.id ?? null;
    if (myId) {
      useGameStore.getState().initGame(payload.state, myId);
    }
  });

  // game:end — 게임 종료, 전체 상태 리셋
  useWsEvent<GameEndPayload>("game", WsEventType.GAME_END, (payload) => {
    syncServerTime(payload.ts);
    useGameStore.getState().resetGame();
    clearModuleStores();
  });

  // session:player:joined — 플레이어 입장
  useWsEvent<PlayerJoinedPayload>("game", WsEventType.SESSION_PLAYER_JOINED, (payload) => {
    syncServerTime(payload.ts);
    useGameStore.getState().addPlayer(payload.player);
  });

  // session:player:left — 플레이어 퇴장
  useWsEvent<PlayerLeftPayload>("game", WsEventType.SESSION_PLAYER_LEFT, (payload) => {
    syncServerTime(payload.ts);
    useGameStore.getState().removePlayer(payload.playerId);
  });

  // module:state — 모듈 전체 상태 교체
  useWsEvent<ModuleStatePayload>("game", WsEventType.MODULE_STATE, (payload) => {
    syncServerTime(payload.ts);
    const store = getModuleStore(payload.moduleId);
    store.getState().setData(payload.data);
  });

  // module:event — 모듈 부분 상태 병합
  useWsEvent<ModuleEventPayload>("game", WsEventType.MODULE_EVENT, (payload) => {
    syncServerTime(payload.ts);
    const store = getModuleStore(payload.moduleId);
    store.getState().mergeData(payload.data);
  });
}
