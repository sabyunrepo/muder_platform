import { useCallback } from "react";

import { useAuthStore } from "@/stores/authStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { api } from "@/services/api";
import { getOAuthUrl } from "@/features/auth/oauth-urls";
import type { User } from "@/stores/authStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (provider: "kakao" | "google") => void;
  logout: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * 인증 상태 통합 hook.
 * authStore + connectionStore + API 호출을 하나로 묶어
 * 인증 관련 모든 기능에 접근할 수 있다.
 */
export function useAuth(): UseAuthReturn {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const authLogout = useAuthStore((s) => s.logout);
  const disconnectAll = useConnectionStore((s) => s.disconnectAll);

  const login = useCallback((provider: "kakao" | "google") => {
    window.location.href = getOAuthUrl(provider);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.postVoid("/v1/auth/logout");
    } catch {
      // 서버 로그아웃 실패해도 로컬 정리 진행
    } finally {
      authLogout();
      disconnectAll();
    }
  }, [authLogout, disconnectAll]);

  return { user, isAuthenticated, isLoading, login, logout };
}
