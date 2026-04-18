import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { getModuleStore } from "../moduleStoreFactory";
import { useModuleStore } from "../useModuleStore";
import { clearBySessionId, clearModuleStores } from "../moduleStoreCleanup";
import { useGameSessionStore } from "../gameSessionStore";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("moduleStoreFactory", () => {
  beforeEach(() => {
    clearModuleStores();
    useGameSessionStore.setState({
      sessionId: null,
      phase: null,
      players: [],
      modules: [],
      round: 0,
      phaseDeadline: null,
      isGameActive: false,
      myPlayerId: null,
      myRole: null,
    });
  });

  // -------------------------------------------------------------------------
  // getModuleStore
  // -------------------------------------------------------------------------

  describe("getModuleStore", () => {
    it("새 스토어를 생성한다", () => {
      const store = getModuleStore("mod-a", "sess-1");
      expect(store).toBeDefined();
      expect(store.getState().moduleId).toBe("mod-a");
      expect(store.getState().sessionId).toBe("sess-1");
    });

    it("같은 (moduleId, sessionId) 조합은 캐시된 인스턴스를 반환한다", () => {
      const a = getModuleStore("mod-a", "sess-1");
      const b = getModuleStore("mod-a", "sess-1");
      expect(a).toBe(b);
    });

    it("다른 moduleId는 다른 인스턴스를 반환한다", () => {
      const a = getModuleStore("mod-a", "sess-1");
      const b = getModuleStore("mod-b", "sess-1");
      expect(a).not.toBe(b);
    });

    it("같은 moduleId라도 sessionId가 다르면 다른 인스턴스를 반환한다 (F-react-6)", () => {
      const a = getModuleStore("mod-a", "sess-1");
      const b = getModuleStore("mod-a", "sess-2");
      expect(a).not.toBe(b);
    });

    it("세션 격리 — 한 세션 변경은 다른 세션에 영향 없다", () => {
      const a = getModuleStore("mod-a", "sess-1");
      const b = getModuleStore("mod-a", "sess-2");
      a.getState().setData({ secret: "sess-1" });
      expect(a.getState().data).toEqual({ secret: "sess-1" });
      expect(b.getState().data).toEqual({});
    });

    it("초기 상태가 올바르다", () => {
      const store = getModuleStore("mod-x", "sess-1");
      const s = store.getState();
      expect(s.moduleId).toBe("mod-x");
      expect(s.sessionId).toBe("sess-1");
      expect(s.data).toEqual({});
      expect(s.isActive).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // dev warning (sessionId 없이 호출)
  // -------------------------------------------------------------------------

  describe("dev warning", () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it("sessionId 없이 호출 시 DEV에서 console.warn을 호출한다", () => {
      getModuleStore("mod-nowarn");
      // vitest 기본은 DEV=true (import.meta.env.DEV)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("getModuleStore(\"mod-nowarn\") called without sessionId"),
      );
    });

    it("sessionId 전달 시 warn을 호출하지 않는다", () => {
      getModuleStore("mod-nowarn", "sess-1");
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("sessionId=null (명시적 null)도 legacy로 간주하고 warn한다", () => {
      getModuleStore("mod-null-sess", null);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // setData / mergeData / reset / setActive (기존 계약 유지)
  // -------------------------------------------------------------------------

  describe("actions", () => {
    it("setData는 data를 교체한다", () => {
      const store = getModuleStore("mod-a", "sess-1");
      store.getState().setData({ key: "value" });
      expect(store.getState().data).toEqual({ key: "value" });

      store.getState().setData({ next: 1 });
      expect(store.getState().data).toEqual({ next: 1 });
    });

    it("mergeData는 부분 병합한다", () => {
      const store = getModuleStore("mod-a", "sess-1");
      store.getState().setData({ a: 1 });
      store.getState().mergeData({ b: 2 });
      expect(store.getState().data).toEqual({ a: 1, b: 2 });
    });

    it("mergeData는 기존 키를 덮어쓴다", () => {
      const store = getModuleStore("mod-a", "sess-1");
      store.getState().setData({ a: 1, b: 2 });
      store.getState().mergeData({ a: 99 });
      expect(store.getState().data).toEqual({ a: 99, b: 2 });
    });

    it("reset은 초기 상태로 복원한다", () => {
      const store = getModuleStore("mod-a", "sess-1");
      store.getState().setData({ a: 1 });
      store.getState().setActive(true);
      store.getState().reset();

      const s = store.getState();
      expect(s.data).toEqual({});
      expect(s.isActive).toBe(false);
      expect(s.moduleId).toBe("mod-a");
      expect(s.sessionId).toBe("sess-1");
    });

    it("setActive는 isActive를 토글한다", () => {
      const store = getModuleStore("mod-a", "sess-1");
      store.getState().setActive(true);
      expect(store.getState().isActive).toBe(true);
      store.getState().setActive(false);
      expect(store.getState().isActive).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // clearBySessionId
  // -------------------------------------------------------------------------

  describe("clearBySessionId", () => {
    it("지정한 sessionId의 스토어만 reset하고 캐시에서 제거한다", () => {
      const a1 = getModuleStore("mod-a", "sess-1");
      const a2 = getModuleStore("mod-a", "sess-2");
      a1.getState().setData({ v: 1 });
      a2.getState().setData({ v: 2 });

      clearBySessionId("sess-1");

      // sess-1 스토어는 reset됨
      expect(a1.getState().data).toEqual({});

      // sess-2 스토어는 보존됨
      expect(a2.getState().data).toEqual({ v: 2 });

      // sess-1 재조회 시 새 인스턴스
      const a1New = getModuleStore("mod-a", "sess-1");
      expect(a1New).not.toBe(a1);

      // sess-2 재조회 시 같은 인스턴스
      const a2Same = getModuleStore("mod-a", "sess-2");
      expect(a2Same).toBe(a2);
    });

    it("sessionId가 null이면 no-op", () => {
      const store = getModuleStore("mod-a", "sess-1");
      store.getState().setData({ v: 1 });

      clearBySessionId(null);

      expect(store.getState().data).toEqual({ v: 1 });
    });

    it("같은 sessionId에 속한 여러 모듈을 모두 정리한다", () => {
      const a = getModuleStore("mod-a", "sess-1");
      const b = getModuleStore("mod-b", "sess-1");
      a.getState().setData({ v: 1 });
      b.getState().setData({ v: 2 });

      clearBySessionId("sess-1");

      expect(a.getState().data).toEqual({});
      expect(b.getState().data).toEqual({});
    });
  });

  // -------------------------------------------------------------------------
  // clearModuleStores (전역 teardown)
  // -------------------------------------------------------------------------

  describe("clearModuleStores", () => {
    it("모든 세션의 스토어를 reset하고 캐시를 비운다", () => {
      const a = getModuleStore("mod-a", "sess-1");
      const b = getModuleStore("mod-b", "sess-2");
      a.getState().setData({ v: 1 });
      b.getState().setActive(true);

      clearModuleStores();

      // 재조회 시 새 인스턴스
      const a2 = getModuleStore("mod-a", "sess-1");
      expect(a2).not.toBe(a);
      expect(a2.getState().data).toEqual({});
    });

    it("정리 후 기존 참조의 상태도 reset된다", () => {
      const store = getModuleStore("mod-a", "sess-1");
      store.getState().setData({ key: "val" });
      store.getState().setActive(true);

      clearModuleStores();

      expect(store.getState().data).toEqual({});
      expect(store.getState().isActive).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // resetGame 연계 (F-react-6 핵심)
  // -------------------------------------------------------------------------

  describe("gameSessionStore.resetGame 연계", () => {
    it("resetGame 시 해당 sessionId의 모듈 스토어만 정리된다", () => {
      const a = getModuleStore("mod-a", "sess-active");
      const b = getModuleStore("mod-a", "sess-other");
      a.getState().setData({ v: 1 });
      b.getState().setData({ v: 2 });

      // 현재 게임 세션을 sess-active로 설정
      useGameSessionStore.setState({ sessionId: "sess-active" });
      useGameSessionStore.getState().resetGame();

      // sess-active 스토어는 reset됨
      expect(a.getState().data).toEqual({});

      // sess-other 스토어는 보존됨
      expect(b.getState().data).toEqual({ v: 2 });
    });
  });

  // -------------------------------------------------------------------------
  // useModuleStore (React hook)
  // -------------------------------------------------------------------------

  describe("useModuleStore", () => {
    let hookWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // hook은 자동으로 useGameSessionStore.sessionId를 읽는다
      useGameSessionStore.setState({ sessionId: "sess-hook" });
      // renderHook cleanup 중에 이전 테스트의 hook이 다시 평가되며 sessionId=null
      // 상태에서 warn이 날 수 있어 이 block에서는 console.warn을 silent 처리.
      hookWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    afterEach(() => {
      hookWarnSpy.mockRestore();
    });

    it("현재 세션의 모듈 스토어의 전체 상태를 반환한다", () => {
      const { result } = renderHook(() => useModuleStore("mod-hook"));

      expect(result.current.moduleId).toBe("mod-hook");
      expect(result.current.sessionId).toBe("sess-hook");
      expect(result.current.data).toEqual({});
      expect(result.current.isActive).toBe(false);
    });

    it("selector로 특정 값만 반환한다", () => {
      const store = getModuleStore("mod-sel", "sess-hook");
      store.getState().setData({ x: 42 });

      const { result } = renderHook(() => useModuleStore("mod-sel", (s) => s.data));

      expect(result.current).toEqual({ x: 42 });
    });

    it("스토어 변경이 hook에 반영된다", () => {
      const store = getModuleStore("mod-react", "sess-hook");
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
        getModuleStore("mod-same", "sess-hook").getState().setData({ shared: true });
      });

      expect(r1.current.data).toEqual({ shared: true });
      expect(r2.current.data).toEqual({ shared: true });
    });

    it("sessionId override가 명시되면 해당 세션 스토어를 구독한다", () => {
      const explicit = getModuleStore("mod-override", "sess-explicit");
      explicit.getState().setData({ tag: "explicit" });

      const { result } = renderHook(() =>
        useModuleStore("mod-override", (s) => s.data, "sess-explicit"),
      );

      expect(result.current).toEqual({ tag: "explicit" });
    });
  });
});
