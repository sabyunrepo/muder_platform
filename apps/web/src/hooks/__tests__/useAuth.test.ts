import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useAuthStore } from "@/stores/authStore";

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
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/services/api", () => ({
  api: {
    postVoid: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/stores/connectionStore", () => {
  const disconnectAll = vi.fn();
  return {
    useConnectionStore: vi.fn((selector: (s: { disconnectAll: typeof disconnectAll }) => unknown) =>
      selector({ disconnectAll }),
    ),
    __disconnectAll: disconnectAll,
  };
});

// import after mocks
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";

// @ts-expect-error -- 테스트 전용 내보내기
import { __disconnectAll } from "@/stores/connectionStore";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockUser = {
  id: "user-1",
  nickname: "TestUser",
  email: "test@example.com",
  profileImage: null,
  role: "user" as const,
  provider: "google",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAuth", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  describe("상태 반환", () => {
    it("authStore의 user를 반환한다", () => {
      useAuthStore.setState({ user: mockUser, isAuthenticated: true });

      const { result } = renderHook(() => useAuth());

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it("authStore의 isLoading을 반환한다", () => {
      useAuthStore.setState({ isLoading: true });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("login", () => {
    it("kakao 로그인 시 window.location.href를 카카오 OAuth URL로 변경한다", () => {
      const originalLocation = window.location;
      const hrefSetter = vi.fn();
      Object.defineProperty(window, "location", {
        value: {
          ...originalLocation,
          origin: "http://localhost:3000",
          href: "http://localhost:3000",
        },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window.location, "href", {
        set: hrefSetter,
        get: () => "http://localhost:3000",
        configurable: true,
      });

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.login("kakao");
      });

      expect(hrefSetter).toHaveBeenCalledTimes(1);
      const url = hrefSetter.mock.calls[0]![0] as string;
      expect(url).toContain("kauth.kakao.com/oauth/authorize");
      expect(url).toContain("redirect_uri=");

      // 복원
      Object.defineProperty(window, "location", {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    });

    it("google 로그인 시 window.location.href를 구글 OAuth URL로 변경한다", () => {
      const originalLocation = window.location;
      const hrefSetter = vi.fn();
      Object.defineProperty(window, "location", {
        value: {
          ...originalLocation,
          origin: "http://localhost:3000",
          href: "http://localhost:3000",
        },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window.location, "href", {
        set: hrefSetter,
        get: () => "http://localhost:3000",
        configurable: true,
      });

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.login("google");
      });

      expect(hrefSetter).toHaveBeenCalledTimes(1);
      const url = hrefSetter.mock.calls[0]![0] as string;
      expect(url).toContain("accounts.google.com/o/oauth2");
      expect(url).toContain("scope=");

      Object.defineProperty(window, "location", {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    });
  });

  describe("logout", () => {
    it("api.postVoid를 호출한다", async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(api.postVoid).toHaveBeenCalledWith("/v1/auth/logout");
    });

    it("authStore.logout()을 호출한다", async () => {
      useAuthStore.setState({
        user: mockUser,
        accessToken: "access-123",
        refreshToken: "refresh-456",
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.accessToken).toBeNull();
    });

    it("connectionStore.disconnectAll()을 호출한다", async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(__disconnectAll).toHaveBeenCalledTimes(1);
    });

    it("API 실패해도 로컬 상태를 정리한다", async () => {
      vi.mocked(api.postVoid).mockRejectedValueOnce(new Error("Network Error"));

      useAuthStore.setState({
        user: mockUser,
        accessToken: "access-123",
        refreshToken: "refresh-456",
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        // logout은 try/finally이므로 에러가 전파됨 — 테스트에서 잡아준다
        try {
          await result.current.logout();
        } catch {
          // expected
        }
      });

      // API 실패와 무관하게 상태 정리
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(__disconnectAll).toHaveBeenCalled();
    });
  });
});
