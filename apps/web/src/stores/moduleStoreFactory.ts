import { createStore, type StoreApi } from "zustand";
import { useStore } from "zustand";

import { useGameSessionStore } from "./gameSessionStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModuleStoreState {
  moduleId: string;
  sessionId: string;
  data: Record<string, unknown>;
  isActive: boolean;
}

export interface ModuleStoreActions {
  setData: (data: Record<string, unknown>) => void;
  mergeData: (partial: Record<string, unknown>) => void;
  reset: () => void;
  setActive: (active: boolean) => void;
}

type ModuleStore = ModuleStoreState & ModuleStoreActions;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * sessionId 없이 호출된 스토어의 fallback 네임스페이스.
 * 테스트·legacy 호출 호환성을 위해 유지하되, DEV 환경에서는 경고한다.
 */
const GLOBAL_NAMESPACE = "__global__";

/**
 * 캐시 key 포맷: `${sessionId}:${moduleId}`.
 * 세션 전환 시 이전 세션의 모듈 state가 유출되지 않도록 namespace 분리.
 */
const moduleStores = new Map<string, StoreApi<ModuleStore>>();

function makeCacheKey(sessionId: string, moduleId: string): string {
  return `${sessionId}:${moduleId}`;
}

/** 모듈 스토어의 초기 상태 생성 */
function createInitialState(moduleId: string, sessionId: string): ModuleStoreState {
  return {
    moduleId,
    sessionId,
    data: {},
    isActive: false,
  };
}

/**
 * 모듈 ID + sessionId에 해당하는 vanilla 스토어를 반환한다.
 * 같은 (sessionId, moduleId) 조합이면 캐시된 인스턴스를 돌려준다.
 *
 * Phase 19 PR-8 (F-react-6): sessionId namespace 도입으로 세션 전환 시
 * 이전 세션 모듈 state 유출을 방지한다. sessionId 없이 호출하면 DEV 경고 +
 * `__global__` 네임스페이스로 fallback (legacy/test 호환).
 */
export function getModuleStore(
  moduleId: string,
  sessionId?: string | null,
): StoreApi<ModuleStore> {
  const namespace = sessionId ?? GLOBAL_NAMESPACE;
  if (!sessionId && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(
      `[moduleStoreFactory] getModuleStore("${moduleId}") called without sessionId — ` +
        `falling back to "${GLOBAL_NAMESPACE}" namespace. Pass sessionId to isolate ` +
        `per-session module state (F-react-6).`,
    );
  }

  const key = makeCacheKey(namespace, moduleId);
  const existing = moduleStores.get(key);
  if (existing) return existing;

  const store = createStore<ModuleStore>()((set) => ({
    ...createInitialState(moduleId, namespace),

    setData: (data) => {
      set({ data });
    },

    mergeData: (partial) => {
      set((s) => ({ data: { ...s.data, ...partial } }));
    },

    reset: () => {
      set(createInitialState(moduleId, namespace));
    },

    setActive: (active) => {
      set({ isActive: active });
    },
  }));

  moduleStores.set(key, store);
  return store;
}

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

/**
 * 지정한 sessionId에 속한 모든 모듈 스토어를 reset 후 캐시에서 제거한다.
 * 다른 세션의 스토어는 보존된다. resetGame 직전 호출해 이전 세션의
 * 모듈 state가 유출되지 않도록 한다.
 */
export function clearBySessionId(sessionId: string | null | undefined): void {
  if (!sessionId) return;
  const prefix = `${sessionId}:`;
  for (const [key, store] of moduleStores.entries()) {
    if (key.startsWith(prefix)) {
      store.getState().reset();
      moduleStores.delete(key);
    }
  }
}

/**
 * 전역 정리: 모든 세션의 모듈 스토어를 제거한다.
 * 로그아웃이나 앱 종료 등 명시적 teardown 상황에서만 호출.
 */
export function clearModuleStores(): void {
  for (const store of moduleStores.values()) {
    store.getState().reset();
  }
  moduleStores.clear();
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectModuleData = (s: ModuleStoreState) => s.data;
export const selectModuleIsActive = (s: ModuleStoreState) => s.isActive;
export const selectModuleId = (s: ModuleStoreState) => s.moduleId;
export const selectModuleSessionId = (s: ModuleStoreState) => s.sessionId;
