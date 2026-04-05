import { createStore, type StoreApi } from "zustand";
import { useStore } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModuleStoreState {
  moduleId: string;
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

/** 모듈 ID별 스토어 인스턴스 캐시 */
const moduleStores = new Map<string, StoreApi<ModuleStore>>();

/** 모듈 스토어의 초기 상태 생성 */
function createInitialState(moduleId: string): ModuleStoreState {
  return {
    moduleId,
    data: {},
    isActive: false,
  };
}

/**
 * 모듈 ID에 해당하는 vanilla 스토어를 반환한다.
 * 같은 moduleId면 캐시된 인스턴스를 돌려준다.
 */
export function getModuleStore(moduleId: string): StoreApi<ModuleStore> {
  const existing = moduleStores.get(moduleId);
  if (existing) return existing;

  const store = createStore<ModuleStore>()((set) => ({
    ...createInitialState(moduleId),

    setData: (data) => {
      set({ data });
    },

    mergeData: (partial) => {
      set((s) => ({ data: { ...s.data, ...partial } }));
    },

    reset: () => {
      set(createInitialState(moduleId));
    },

    setActive: (active) => {
      set({ isActive: active });
    },
  }));

  moduleStores.set(moduleId, store);
  return store;
}

/**
 * React 컴포넌트에서 모듈 스토어를 구독하는 hook.
 * moduleId가 바뀌면 해당 모듈의 스토어로 자동 전환된다.
 */
export function useModuleStore(moduleId: string): ModuleStore;
export function useModuleStore<T>(moduleId: string, selector: (s: ModuleStore) => T): T;
export function useModuleStore<T>(
  moduleId: string,
  selector?: (s: ModuleStore) => T,
): T | ModuleStore {
  const store = getModuleStore(moduleId);
  // selector가 없으면 전체 상태 반환
  return useStore(store, selector ?? ((s) => s as unknown as T));
}

/**
 * 게임 종료 시 모든 모듈 스토어를 정리한다.
 * 각 스토어를 reset 후 캐시에서 제거한다.
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
