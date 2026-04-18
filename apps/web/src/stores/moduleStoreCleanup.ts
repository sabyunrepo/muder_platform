import { _moduleStoresInternal } from "./moduleStoreFactory";

// ---------------------------------------------------------------------------
// Cleanup API
// ---------------------------------------------------------------------------
//
// Phase 19 PR-11 (store cleanup decoupling): `moduleStoreFactory`가
// `gameSessionStore`를 import하고, `gameSessionStore`가 `moduleStoreFactory`의
// cleanup 함수를 import하는 circular dependency를 해소한다.
//
// 이 파일은 factory의 internal Map만 import하고, domain store(gameSessionStore)는
// 전혀 참조하지 않는다. `gameSessionStore.resetGame` → `clearBySessionId` 호출
// 경로의 한 방향 dependency만 유지된다.
//
// 의존성 방향:
//   moduleStoreFactory.ts   (핵심 Map + getModuleStore)
//         ↑
//   moduleStoreCleanup.ts   (cleanup 함수 — 이 파일)
//         ↑
//   gameSessionStore.ts     (resetGame → clearBySessionId)
//
// ---------------------------------------------------------------------------

/**
 * 지정한 sessionId에 속한 모든 모듈 스토어를 reset 후 캐시에서 제거한다.
 * 다른 세션의 스토어는 보존된다. `gameSessionStore.resetGame` 직전 호출해
 * 이전 세션의 모듈 state가 유출되지 않도록 한다.
 */
export function clearBySessionId(sessionId: string | null | undefined): void {
  if (!sessionId) return;
  const prefix = `${sessionId}:`;
  for (const [key, store] of _moduleStoresInternal.entries()) {
    if (key.startsWith(prefix)) {
      store.getState().reset();
      _moduleStoresInternal.delete(key);
    }
  }
}

/**
 * 전역 정리: 모든 세션의 모듈 스토어를 제거한다.
 * 로그아웃이나 앱 종료 등 명시적 teardown 상황에서만 호출.
 */
export function clearModuleStores(): void {
  for (const store of _moduleStoresInternal.values()) {
    store.getState().reset();
  }
  _moduleStoresInternal.clear();
}
