import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  nickname: string;
  email: string;
  profileImage: string | null;
  role: "user" | "creator" | "admin";
  provider: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthActions {
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  clear: () => void;
  setLoading: (loading: boolean) => void;
  initialize: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REFRESH_TOKEN_KEY = "mmp_refresh_token";

// 동기적으로 localStorage에서 refreshToken 복원 (flash redirect 방지)
const storedRefreshToken = (() => {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
})();

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: storedRefreshToken,
  isAuthenticated: false,
  isLoading: !!storedRefreshToken,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  ...initialState,

  setTokens: (access, refresh) => {
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
    set({ accessToken: access, refreshToken: refresh });
  },

  setUser: (user) => {
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    set({ ...initialState });
  },

  clear: () => {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    set({ ...initialState });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  initialize: () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    set({ refreshToken, isLoading: !!refreshToken });
  },
}));

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectUser = (s: AuthState) => s.user;
export const selectIsAuthenticated = (s: AuthState) => s.isAuthenticated;
export const selectAccessToken = (s: AuthState) => s.accessToken;
export const selectRefreshToken = (s: AuthState) => s.refreshToken;
export const selectIsLoading = (s: AuthState) => s.isLoading;
