import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import { profileApi } from "@/services/profileApi";
import { queryClient } from "@/services/queryClient";
import { useAuthStore } from "@/stores/authStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationPrefs {
  game_invite: boolean;
  room_status: boolean;
  marketing: boolean;
}

interface ProfileResponse {
  id: string;
  nickname: string;
  email: string;
  avatar_url: string | null;
  role: string;
  provider: string;
  bio: string | null;
  total_games: number;
  win_count: number;
  created_at: string;
  updated_at: string;
}

interface UpdateProfileRequest {
  nickname?: string;
  bio?: string;
  avatar_url?: string | null;
}

interface PublicProfileResponse {
  id: string;
  nickname: string;
  avatar_url: string | null;
  bio: string | null;
  total_games: number;
  win_count: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const profileKeys = {
  all: ["profile"] as const,
  me: () => [...profileKeys.all, "me"] as const,
  public: (userId: string) => ["users", userId] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useProfile() {
  return useQuery<ProfileResponse>({
    queryKey: profileKeys.me(),
    queryFn: () => api.get<ProfileResponse>("/v1/profile"),
  });
}

export function usePublicProfile(userId: string) {
  return useQuery<PublicProfileResponse>({
    queryKey: profileKeys.public(userId),
    queryFn: () =>
      api.get<PublicProfileResponse>(`/v1/users/${userId}`),
    enabled: !!userId,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useUpdateProfile() {
  return useMutation<ProfileResponse, Error, UpdateProfileRequest>({
    mutationFn: (body) =>
      api.put<ProfileResponse>("/v1/profile", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    },
  });
}

export function useUploadAvatar() {
  return useMutation<{ avatar_url: string }, Error, Blob>({
    mutationFn: (file) => profileApi.uploadAvatar(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    },
  });
}

// ---------------------------------------------------------------------------
// 알림 설정
// ---------------------------------------------------------------------------

export const notificationKeys = {
  all: ["notifications"] as const,
  prefs: () => [...notificationKeys.all, "prefs"] as const,
};

export function useNotificationPrefs() {
  return useQuery<NotificationPrefs>({
    queryKey: notificationKeys.prefs(),
    queryFn: () => api.get<NotificationPrefs>("/v1/profile/notifications"),
  });
}

export function useUpdateNotificationPrefs() {
  return useMutation<NotificationPrefs, Error, NotificationPrefs>({
    mutationFn: (body) =>
      api.put<NotificationPrefs>("/v1/profile/notifications", body),
    onSuccess: (data) => {
      queryClient.setQueryData(notificationKeys.prefs(), data);
    },
  });
}

// ---------------------------------------------------------------------------
// 계정 삭제
// ---------------------------------------------------------------------------

export function useDeleteAccount() {
  const logout = useAuthStore((s) => s.logout);

  return useMutation<void, Error, { password?: string }>({
    mutationFn: ({ password }) =>
      api.deleteVoid("/v1/auth/account", { body: password ? { password } : {} }),
    onSuccess: () => {
      queryClient.clear();
      logout();
    },
  });
}
