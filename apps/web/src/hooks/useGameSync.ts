import { WsEventType } from "@mmp/shared";
import type { GamePhase, GameState, Player } from "@mmp/shared";
import { syncServerTime } from "@mmp/game-logic";

import { useAuthStore } from "@/stores/authStore";
import { useGameSessionStore as useGameStore } from "@/stores/gameSessionStore";
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
 *
 * Phase 19 PR-7: `.getState()` 패턴 대신 Zustand selector로 action을
 * 바인딩한다. Zustand action은 안정된 참조를 가지므로 selector가
 * 리렌더를 유발하지 않으면서 `useGameStore.getState()` 호출이 제거된다.
 * 이전에 병행 존재하던 `gameMessageHandlers.ts`와
 * `features/game/hooks/useGameSession.ts`는 실제 호출처가 없는
 * dead code였기에 같은 PR에서 삭제되었다.
 */
export function useGameSync(): void {
  const hydrateFromSnapshot = useGameStore((s) => s.hydrateFromSnapshot);
  const setPhase = useGameStore((s) => s.setPhase);
  const initGame = useGameStore((s) => s.initGame);
  const resetGame = useGameStore((s) => s.resetGame);
  const addPlayer = useGameStore((s) => s.addPlayer);
  const removePlayer = useGameStore((s) => s.removePlayer);
  const myId = useAuthStore((s) => s.user?.id ?? null);

  // session:state — 재접속 시 서버 스냅샷으로 전체 상태 복원
  useWsEvent<SessionStatePayload>("game", WsEventType.SESSION_STATE, (payload) => {
    syncServerTime(payload.ts);
    hydrateFromSnapshot(payload.state);
  });

  // phase.advanced — 페이즈 전환
  useWsEvent<PhaseChangePayload>("game", WsEventType.PHASE_ADVANCED, (payload) => {
    syncServerTime(payload.ts);
    setPhase(payload.phase, payload.deadline, payload.round);
  });

  // game:start — 게임 시작, 내 플레이어 ID로 초기화
  useWsEvent<GameStartPayload>("game", WsEventType.GAME_START, (payload) => {
    syncServerTime(payload.ts);
    if (myId) {
      initGame(payload.state, myId);
    }
  });

  // game:end — 게임 종료, 전체 상태 리셋
  useWsEvent<GameEndPayload>("game", WsEventType.GAME_END, (payload) => {
    syncServerTime(payload.ts);
    resetGame();
    clearModuleStores();
  });

  // player.joined — 플레이어 입장
  useWsEvent<PlayerJoinedPayload>("game", WsEventType.PLAYER_JOINED, (payload) => {
    syncServerTime(payload.ts);
    addPlayer(payload.player);
  });

  // player.left — 플레이어 퇴장
  useWsEvent<PlayerLeftPayload>("game", WsEventType.PLAYER_LEFT, (payload) => {
    syncServerTime(payload.ts);
    removePlayer(payload.playerId);
  });

  // module:state — 모듈 전체 상태 교체
  // Factory의 store.getState()는 PR-8 Module Cache Isolation에서 sessionId
  // namespace 도입과 함께 최적화될 예정이므로 이번 PR에서는 유지한다.
  useWsEvent<ModuleStatePayload>("game", WsEventType.MODULE_STATE, (payload) => {
    syncServerTime(payload.ts);
    getModuleStore(payload.moduleId).getState().setData(payload.data);
  });

  // module:event — 모듈 부분 상태 병합
  useWsEvent<ModuleEventPayload>("game", WsEventType.MODULE_EVENT, (payload) => {
    syncServerTime(payload.ts);
    getModuleStore(payload.moduleId).getState().mergeData(payload.data);
  });
}
