import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryClient } from "@/services/queryClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PendingTheme {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  min_players: number;
  max_players: number;
  duration_min: number;
  status: string;
  creator_id: string;
  creator_name: string;
  version: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

const reviewKeys = {
  pending: ["admin", "reviews", "pending"] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function usePendingReviews() {
  return useQuery<PendingTheme[]>({
    queryKey: reviewKeys.pending,
    queryFn: () => api.get<PendingTheme[]>("/v1/admin/reviews"),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useApproveTheme() {
  return useMutation<void, Error, { themeId: string; note?: string }>({
    mutationFn: ({ themeId, note }) =>
      api.postVoid(
        `/v1/admin/reviews/${themeId}/approve`,
        note ? { note } : undefined,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.pending });
    },
  });
}

export function useRejectTheme() {
  return useMutation<void, Error, { themeId: string; note: string }>({
    mutationFn: ({ themeId, note }) =>
      api.postVoid(`/v1/admin/reviews/${themeId}/reject`, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.pending });
    },
  });
}

export function useSuspendTheme() {
  return useMutation<void, Error, { themeId: string; note: string }>({
    mutationFn: ({ themeId, note }) =>
      api.postVoid(`/v1/admin/reviews/${themeId}/suspend`, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.pending });
    },
  });
}

export function useSetTrustedCreator() {
  return useMutation<
    void,
    Error,
    { userId: string; trusted: boolean }
  >({
    mutationFn: ({ userId, trusted }) =>
      api.putVoid(`/v1/admin/users/${userId}/trusted-creator`, { trusted }),
  });
}
