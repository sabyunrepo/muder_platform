import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryClient } from "@/services/queryClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThemeSummary {
  id: string;
  title: string;
  slug: string;
  description: string;
  // Server JSON (theme.service.go ThemeSummary) — min_players / max_players /
  // duration_min / cover_image. Keep snake_case names aligned with backend.
  min_players: number;
  max_players: number;
  duration_min: number;
  cover_image?: string | null;
  coin_price: number;
  // Not yet returned by the server — optional until the contract extends.
  // See docs/plans/2026-04-16-e2e-recovery/refs/findings.md H6.
  difficulty?: string;
  play_count?: number;
  rating?: number;
}

export interface ThemeResponse extends ThemeSummary {
  content: string;
  roles: ThemeRole[];
}

export interface ThemeRole {
  id: string;
  name: string;
  description: string;
  is_murderer: boolean;
}

export interface RoomResponse {
  id: string;
  code: string;
  theme_id: string;
  theme_title: string;
  host_id: string;
  host_nickname: string;
  status: string;
  player_count: number;
  max_players: number;
  is_private: boolean;
  created_at: string;
}

export interface RoomDetailResponse extends RoomResponse {
  players: RoomPlayer[];
  theme: ThemeSummary;
}

export interface RoomPlayer {
  id: string;
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  is_host: boolean;
  is_ready: boolean;
  joined_at: string;
}

export interface CreateRoomRequest {
  theme_id: string;
  is_private?: boolean;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const themeKeys = {
  all: ["themes"] as const,
  list: (params?: PaginationParams) =>
    [...themeKeys.all, "list", params ?? {}] as const,
  detail: (id: string) => [...themeKeys.all, id] as const,
};

export const roomKeys = {
  all: ["rooms"] as const,
  list: (params?: PaginationParams) =>
    [...roomKeys.all, "list", params ?? {}] as const,
  detail: (id: string) => [...roomKeys.all, id] as const,
  byCode: (code: string) => [...roomKeys.all, "code", code] as const,
};

// ---------------------------------------------------------------------------
// Theme Queries
// ---------------------------------------------------------------------------

export function useThemes(params?: PaginationParams) {
  const searchParams = new URLSearchParams();
  if (params?.limit != null) searchParams.set("limit", String(params.limit));
  if (params?.offset != null) searchParams.set("offset", String(params.offset));
  const qs = searchParams.toString();

  return useQuery<ThemeSummary[]>({
    queryKey: themeKeys.list(params),
    queryFn: () => api.get<ThemeSummary[]>(`/v1/themes${qs ? `?${qs}` : ""}`),
  });
}

export function useTheme(id: string) {
  return useQuery<ThemeResponse>({
    queryKey: themeKeys.detail(id),
    queryFn: () => api.get<ThemeResponse>(`/v1/themes/${id}`),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Room Queries
// ---------------------------------------------------------------------------

export function useRooms(params?: PaginationParams) {
  const searchParams = new URLSearchParams();
  if (params?.limit != null) searchParams.set("limit", String(params.limit));
  if (params?.offset != null) searchParams.set("offset", String(params.offset));
  const qs = searchParams.toString();

  return useQuery<RoomResponse[]>({
    queryKey: roomKeys.list(params),
    queryFn: () => api.get<RoomResponse[]>(`/v1/rooms${qs ? `?${qs}` : ""}`),
  });
}

export function useRoom(id: string) {
  return useQuery<RoomDetailResponse>({
    queryKey: roomKeys.detail(id),
    queryFn: () => api.get<RoomDetailResponse>(`/v1/rooms/${id}`),
    enabled: !!id,
  });
}

export function useRoomByCode(code: string) {
  return useQuery<RoomDetailResponse>({
    queryKey: roomKeys.byCode(code),
    queryFn: () => api.get<RoomDetailResponse>(`/v1/rooms/code/${code}`),
    enabled: !!code,
  });
}

// ---------------------------------------------------------------------------
// Room Mutations
// ---------------------------------------------------------------------------

export function useCreateRoom() {
  return useMutation<RoomDetailResponse, Error, CreateRoomRequest>({
    mutationFn: (body) =>
      api.post<RoomDetailResponse>("/v1/rooms", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roomKeys.all });
    },
  });
}

export function useJoinRoom() {
  return useMutation<RoomDetailResponse, Error, string>({
    mutationFn: (roomId) =>
      api.post<RoomDetailResponse>(`/v1/rooms/${roomId}/join`),
    onSuccess: (_data, roomId) => {
      queryClient.invalidateQueries({ queryKey: roomKeys.detail(roomId) });
      queryClient.invalidateQueries({ queryKey: roomKeys.list() });
    },
  });
}

export function useLeaveRoom() {
  return useMutation<void, Error, string>({
    mutationFn: (roomId) => api.postVoid(`/v1/rooms/${roomId}/leave`),
    onSuccess: (_data, roomId) => {
      queryClient.invalidateQueries({ queryKey: roomKeys.detail(roomId) });
      queryClient.invalidateQueries({ queryKey: roomKeys.list() });
    },
  });
}
