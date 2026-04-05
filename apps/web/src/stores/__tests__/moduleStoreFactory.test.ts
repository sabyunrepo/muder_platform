import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  getModuleStore,
  useModuleStore,
  clearModuleStores,
} from "../moduleStoreFactory";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("moduleStoreFactory", () => {
  beforeEach(() => {
    clearModuleStores();
  });

  // -------------------------------------------------------------------------
  // getModuleStore
  // -------------------------------------------------------------------------

  describe("getModuleStore", () => {
    it("새 스토어를 생성한다", () => {
      const store = getModuleStore("mod-a");
      expect(store).toBeDefined();
      expect(store.getState().moduleId).toBe("mod-a");
    });

    it("같은 ID면 캐시된 인스턴스를 반환한다", () => {
      const a = getModuleStore("mod-a");
      const b = getModuleStore("mod-a");
      expect(a).toBe(b);
    });

    it("다른 ID면 다른 인스턴스를 반환한다", () => {
      const a = getModuleStore("mod-a");
      const b = getModuleStore("mod-b");
      expect(a).not.toBe(b);
    });

    it("초기 상태가 올바르다", () => {
      const store = getModuleStore("mod-x");
      const s = store.getState();
      expect(s.moduleId).toBe("mod-x");
      expect(s.data).toEqual({});
      expect(s.isActive).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // setData
  // -------------------------------------------------------------------------

  describe("setData", () => {
    it("data를 교체한다", () => {
      const store = getModuleStore("mod-a");
      store.getState().setData({ key: "value" });
      expect(store.getState().data).toEqual({ key: "value" });
    });

    it("이전 data를 완전히 교체한다", () => {
      const store = getModuleStore("mod-a");
      store.getState().setData({ a: 1, b: 2 });
      store.getState().setData({ c: 3 });
      expect(store.getState().data).toEqual({ c: 3 });
    });
  });

  // -------------------------------------------------------------------------
  // mergeData
  // -------------------------------------------------------------------------

  describe("mergeData", () => {
    it("data를 부분 병합한다", () => {
      const store = getModuleStore("mod-a");
      store.getState().setData({ a: 1 });
      store.getState().mergeData({ b: 2 });
      expect(store.getState().data).toEqual({ a: 1, b: 2 });
    });

    it("기존 키를 덮어쓴다", () => {
      const store = getModuleStore("mod-a");
      store.getState().setData({ a: 1, b: 2 });
      store.getState().mergeData({ a: 99 });
      expect(store.getState().data).toEqual({ a: 99, b: 2 });
    });
  });

  // -------------------------------------------------------------------------
  // reset
  // -------------------------------------------------------------------------

  describe("reset", () => {
    it("초기 상태로 복원한다", () => {
      const store = getModuleStore("mod-a");
      store.getState().setData({ a: 1 });
      store.getState().setActive(true);

      store.getState().reset();

      const s = store.getState();
      expect(s.data).toEqual({});
      expect(s.isActive).toBe(false);
      expect(s.moduleId).toBe("mod-a");
    });
  });

  // -------------------------------------------------------------------------
  // setActive
  // -------------------------------------------------------------------------

  describe("setActive", () => {
    it("isActive를 true로 변경한다", () => {
      const store = getModuleStore("mod-a");
      store.getState().setActive(true);
      expect(store.getState().isActive).toBe(true);
    });

    it("isActive를 false로 변경한다", () => {
      const store = getModuleStore("mod-a");
      store.getState().setActive(true);
      store.getState().setActive(false);
      expect(store.getState().isActive).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // clearModuleStores
  // -------------------------------------------------------------------------

  describe("clearModuleStores", () => {
    it("모든 스토어를 reset하고 캐시를 비운다", () => {
      const storeA = getModuleStore("mod-a");
      const storeB = getModuleStore("mod-b");
      storeA.getState().setData({ a: 1 });
      storeB.getState().setActive(true);

      clearModuleStores();

      // 캐시가 비워졌으므로 새 인스턴스가 생성됨
      const storeA2 = getModuleStore("mod-a");
      expect(storeA2).not.toBe(storeA);
      expect(storeA2.getState().data).toEqual({});
    });

    it("정리 후 기존 스토어는 reset된 상태이다", () => {
      const store = getModuleStore("mod-a");
      store.getState().setData({ key: "val" });
      store.getState().setActive(true);

      clearModuleStores();

      // 기존 참조의 상태도 reset됨
      expect(store.getState().data).toEqual({});
      expect(store.getState().isActive).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // useModuleStore (React hook)
  // -------------------------------------------------------------------------

  describe("useModuleStore", () => {
    it("모듈 스토어의 전체 상태를 반환한다", () => {
      const { result } = renderHook(() => useModuleStore("mod-hook"));

      expect(result.current.moduleId).toBe("mod-hook");
      expect(result.current.data).toEqual({});
      expect(result.current.isActive).toBe(false);
    });

    it("selector로 특정 값만 반환한다", () => {
      const store = getModuleStore("mod-sel");
      store.getState().setData({ x: 42 });

      const { result } = renderHook(() => useModuleStore("mod-sel", (s) => s.data));

      expect(result.current).toEqual({ x: 42 });
    });

    it("스토어 변경이 hook에 반영된다", () => {
      const store = getModuleStore("mod-react");
      const { result } = renderHook(() => useModuleStore("mod-react"));

      act(() => {
        store.getState().setData({ updated: true });
      });

      expect(result.current.data).toEqual({ updated: true });
    });

    it("같은 moduleId면 같은 스토어를 구독한다", () => {
      const { result: r1 } = renderHook(() => useModuleStore("mod-same"));
      const { result: r2 } = renderHook(() => useModuleStore("mod-same"));

      act(() => {
        getModuleStore("mod-same").getState().setData({ shared: true });
      });

      expect(r1.current.data).toEqual({ shared: true });
      expect(r2.current.data).toEqual({ shared: true });
    });
  });
});
