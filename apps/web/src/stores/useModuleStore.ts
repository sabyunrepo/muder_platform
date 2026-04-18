import { useStore } from "zustand";

import { useGameSessionStore } from "./gameSessionStore";
import { getModuleStore, type ModuleStore } from "./moduleStoreFactory";

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------
//
// Phase 19 PR-11: 이 파일은 `gameSessionStore`의 domain layer에 의존하므로
// core factory(`moduleStoreFactory.ts`)에서 분리되었다. 의존성 방향은 단방향:
//
//   gameSessionStore.ts → (no)  useModuleStore.ts
//   useModuleStore.ts   →       moduleStoreFactory.ts, gameSessionStore.ts
//
// factory는 domain layer를 참조하지 않는다.
//
// ---------------------------------------------------------------------------

/**
 * React 컴포넌트에서 모듈 스토어를 구독하는 hook.
 * sessionId는 명시 인자가 없으면 `useGameSessionStore`에서 자동으로 읽는다.
 * 세션이 바뀌면 다른 namespace의 스토어로 자동 전환된다.
 */
export function useModuleStore(moduleId: string): ModuleStore;
export function useModuleStore<T>(moduleId: string, selector: (s: ModuleStore) => T): T;
export function useModuleStore<T>(
  moduleId: string,
  selector: (s: ModuleStore) => T,
  sessionIdOverride: string | null,
): T;
export function useModuleStore<T>(
  moduleId: string,
  selector?: (s: ModuleStore) => T,
  sessionIdOverride?: string | null,
): T | ModuleStore {
  // sessionId override가 명시되면 그 값을, 아니면 현재 게임 세션 id를 사용
  const activeSessionId = useGameSessionStore((s) => s.sessionId);
  const sessionId = sessionIdOverride !== undefined ? sessionIdOverride : activeSessionId;
  const store = getModuleStore(moduleId, sessionId);
  // selector가 없으면 전체 상태 반환
  return useStore(store, selector ?? ((s) => s as unknown as T));
}
