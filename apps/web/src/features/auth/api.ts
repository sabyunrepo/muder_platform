import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryClient } from "@/services/queryClient";
import { useAuthStore } from "@/stores/authStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserResponse {
  id: string;
  nickname: string;
  email: string;
  avatar_url: string | null;
  role: string;
  provider: string;
  created_at: string;
}

interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useMe() {
  const refreshToken = useAuthStore((s) => s.refreshToken);

  return useQuery<UserResponse>({
    queryKey: authKeys.me(),
    queryFn: () => api.get<UserResponse>("/v1/auth/me"),
    enabled: !!refreshToken,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);

  return useMutation<void, Error>({
    mutationFn: () => api.postVoid("/v1/auth/logout"),
    onSuccess: () => {
      logout();
      queryClient.invalidateQueries({ queryKey: authKeys.all });
    },
  });
}

export function useRefreshToken() {
  const setTokens = useAuthStore((s) => s.setTokens);

  return useMutation<TokenPair, Error>({
    mutationFn: () => {
      const refreshToken = useAuthStore.getState().refreshToken;
      return api.post<TokenPair>("/v1/auth/refresh", { refresh_token: refreshToken });
    },
    onSuccess: (data) => {
      setTokens(data.access_token, data.refresh_token);
    },
  });
}
