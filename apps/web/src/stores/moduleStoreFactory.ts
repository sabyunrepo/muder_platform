import { createStore, type StoreApi } from "zustand";

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

export type ModuleStore = ModuleStoreState & ModuleStoreActions;

// ---------------------------------------------------------------------------
// Factory internals
// ---------------------------------------------------------------------------

/**
 * sessionId 없이 호출된 스토어의 fallback 네임스페이스.
 * 테스트·legacy 호출 호환성을 위해 유지하되, DEV 환경에서는 경고한다.
 */
const GLOBAL_NAMESPACE = "__global__";

/**
 * 캐시 key 포맷: `${sessionId}:${moduleId}`.
 * 세션 전환 시 이전 세션의 모듈 state가 유출되지 않도록 namespace 분리.
 *
 * Phase 19 PR-11: 순환 import 해소를 위해 cleanup 함수는 `moduleStoreCleanup.ts`로
 * 분리되었다. 해당 파일에서 이 Map을 직접 조작하기 위해 internal export로 노출한다.
 * 외부 소비자는 `clearBySessionId` / `clearModuleStores` 공개 API를 사용할 것.
 *
 * @internal
 */
export const _moduleStoresInternal = new Map<string, StoreApi<ModuleStore>>();

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

// ---------------------------------------------------------------------------
// Factory API
// ---------------------------------------------------------------------------

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
  const existing = _moduleStoresInternal.get(key);
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

  _moduleStoresInternal.set(key, store);
  return store;
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectModuleData = (s: ModuleStoreState) => s.data;
export const selectModuleIsActive = (s: ModuleStoreState) => s.isActive;
export const selectModuleId = (s: ModuleStoreState) => s.moduleId;
export const selectModuleSessionId = (s: ModuleStoreState) => s.sessionId;

// ---------------------------------------------------------------------------
// Backward-compatible re-exports
// ---------------------------------------------------------------------------

/**
 * React hook 및 cleanup 함수는 각각 별도 파일로 분리되었지만, 기존 import 경로
 * 호환성을 위해 여기서 re-export한다. 새 코드는 가능하면 `useModuleStore` /
 * `moduleStoreCleanup` 경로를 직접 사용할 것.
 *
 * - `useModuleStore` → `./useModuleStore`
 * - `clearBySessionId`, `clearModuleStores` → `./moduleStoreCleanup`
 */
export { useModuleStore } from "./useModuleStore";
export { clearBySessionId, clearModuleStores } from "./moduleStoreCleanup";
