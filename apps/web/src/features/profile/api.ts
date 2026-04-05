import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryClient } from "@/services/queryClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileResponse {
  id: string;
  nickname: string;
  email: string;
  profile_image: string | null;
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
  profile_image?: string | null;
}

interface PublicProfileResponse {
  id: string;
  nickname: string;
  profile_image: string | null;
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
