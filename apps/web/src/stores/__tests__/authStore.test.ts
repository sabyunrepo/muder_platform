import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAuthStore, type User } from "../authStore";

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (_index: number) => null as string | null,
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockUser: User = {
  id: "user-1",
  nickname: "TestUser",
  email: "test@example.com",
  profileImage: null,
  role: "user",
  provider: "google",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("authStore", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
    localStorage.clear();
  });

  describe("초기 상태", () => {
    it("user는 null이다", () => {
      expect(useAuthStore.getState().user).toBeNull();
    });

    it("isAuthenticated는 false이다", () => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it("tokens는 null이다", () => {
      const { accessToken, refreshToken } = useAuthStore.getState();
      expect(accessToken).toBeNull();
      expect(refreshToken).toBeNull();
    });

    it("isLoading은 false이다", () => {
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe("setTokens", () => {
    it("accessToken을 메모리에 저장한다", () => {
      useAuthStore.getState().setTokens("access-123", "refresh-456");
      expect(useAuthStore.getState().accessToken).toBe("access-123");
    });

    it("refreshToken을 상태에 저장한다", () => {
      useAuthStore.getState().setTokens("access-123", "refresh-456");
      expect(useAuthStore.getState().refreshToken).toBe("refresh-456");
    });

    it("refreshToken을 localStorage에 저장한다", () => {
      useAuthStore.getState().setTokens("access-123", "refresh-456");
      expect(localStorage.getItem("mmp_refresh_token")).toBe("refresh-456");
    });
  });

  describe("setUser", () => {
    it("user를 설정한다", () => {
      useAuthStore.getState().setUser(mockUser);
      expect(useAuthStore.getState().user).toEqual(mockUser);
    });

    it("isAuthenticated를 true로 변경한다", () => {
      useAuthStore.getState().setUser(mockUser);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });
  });

  describe("logout", () => {
    it("모든 상태를 초기화한다", () => {
      useAuthStore.getState().setTokens("access-123", "refresh-456");
      useAuthStore.getState().setUser(mockUser);

      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it("localStorage에서 refreshToken을 제거한다", () => {
      useAuthStore.getState().setTokens("access-123", "refresh-456");
      useAuthStore.getState().logout();
      expect(localStorage.getItem("mmp_refresh_token")).toBeNull();
    });

    it("모듈 로드 시 저장 토큰이 있어도 refreshToken과 isLoading을 비운다", async () => {
      vi.resetModules();
      localStorage.setItem("mmp_refresh_token", "saved-refresh");
      const { useAuthStore: loadedStore } = await import("../authStore");

      expect(loadedStore.getState().refreshToken).toBe("saved-refresh");
      expect(loadedStore.getState().isLoading).toBe(true);

      loadedStore.getState().logout();

      expect(loadedStore.getState().refreshToken).toBeNull();
      expect(loadedStore.getState().isLoading).toBe(false);
      expect(localStorage.getItem("mmp_refresh_token")).toBeNull();
    });
  });

  describe("clear", () => {
    it("logout과 동일하게 상태를 초기화한다", () => {
      useAuthStore.getState().setTokens("access-123", "refresh-456");
      useAuthStore.getState().setUser(mockUser);

      useAuthStore.getState().clear();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it("localStorage에서 refreshToken을 제거한다", () => {
      useAuthStore.getState().setTokens("access-123", "refresh-456");
      useAuthStore.getState().clear();
      expect(localStorage.getItem("mmp_refresh_token")).toBeNull();
    });

    it("모듈 로드 시 저장 토큰이 있어도 refreshToken과 isLoading을 비운다", async () => {
      vi.resetModules();
      localStorage.setItem("mmp_refresh_token", "saved-refresh");
      const { useAuthStore: loadedStore } = await import("../authStore");

      expect(loadedStore.getState().refreshToken).toBe("saved-refresh");
      expect(loadedStore.getState().isLoading).toBe(true);

      loadedStore.getState().clear();

      expect(loadedStore.getState().refreshToken).toBeNull();
      expect(loadedStore.getState().isLoading).toBe(false);
      expect(localStorage.getItem("mmp_refresh_token")).toBeNull();
    });
  });

  describe("initialize", () => {
    it("localStorage에서 refreshToken을 복원한다", () => {
      localStorage.setItem("mmp_refresh_token", "saved-refresh");

      useAuthStore.getState().initialize();

      expect(useAuthStore.getState().refreshToken).toBe("saved-refresh");
    });

    it("refreshToken이 있으면 isLoading을 true로 설정한다", () => {
      localStorage.setItem("mmp_refresh_token", "saved-refresh");

      useAuthStore.getState().initialize();

      expect(useAuthStore.getState().isLoading).toBe(true);
    });

    it("refreshToken이 없으면 isLoading을 false로 유지한다", () => {
      useAuthStore.getState().initialize();

      expect(useAuthStore.getState().refreshToken).toBeNull();
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe("setLoading", () => {
    it("isLoading을 true로 변경한다", () => {
      useAuthStore.getState().setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);
    });

    it("isLoading을 false로 변경한다", () => {
      useAuthStore.getState().setLoading(true);
      useAuthStore.getState().setLoading(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });
});
